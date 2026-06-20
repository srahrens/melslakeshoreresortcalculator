import { useState, useEffect } from 'react'
import {Card, Container, Button, Row, Col, ToggleButton, Modal} from 'react-bootstrap';
import './App.css'
import CashPinPad from './CashPinPad.jsx';
import PaymentPinPad from './PaymentPinPad.jsx';

function Ticket(props) {
    const [radioValue, setRadioValue] = useState('Beer'); // for department selection
    const [modifierScreen, setModifierScreen] = useState(null); // for modifier selection screen
    const [currentTicketItem, setCurrentTicketItem] = useState(null); // for tracking which ticket item is being modified when modifiers are being added
    const [ticketItems, setTicketItems] = useState([]);
    const [ticketTotal, setTicketTotal] = useState(0);
    const [selectedItemIndex, setSelectedItemIndex] = useState(null); // for ticket item selection and modification
    const [showCashPad, setShowCashPad] = useState(false);
    const [paymentEntered, setPaymentEntered] = useState(false);
    const [cashGiven, setCashGiven] = useState(0);


    // TODO: Refactor this to add modifiers under each item instead of as separate items on the ticket.
    function addItem(name, price) {
        let priceNum = parseFloat(price.slice(1));
        if (name === 'Open Liquor') {
            setTicketItems(prevItems => {
                return [...prevItems, { name, price: priceNum, qty: 1, id: Date.now() }];
            });
        } else {
            setTicketItems(prevItems => {
                const existingItem = prevItems.find(item => item.name === name);
                if (existingItem) {
                    // Increment quantity if item already exists
                    return prevItems.map(item =>
                        item.name === name ? { ...item, qty: item.qty + 1 } : item
                    );
                } else {
                    // Add new item with quantity 1
                    return [...prevItems, { name, type: "item", department: radioValue, price: priceNum, qty: 1, modifiers: [] }];
                }
            });
        }
        setTicketTotal(prevTotal => prevTotal + priceNum);
    }

    function addModifier(name, price) {
        let priceNum = parseFloat(price.slice(1));
        setTicketItems(prevItems => {
            const existingItem = prevItems.find(item => item.name === name);
            if (existingItem) {
                // Increment quantity if item already exists
                return prevItems.map(item =>
                    item.name === name ? { ...item, qty: item.qty + 1 } : item
                );
            } else {
                // Add new item with quantity 1
                return [...prevItems, { name, type: "modifier", department: radioValue, price: priceNum, qty: 1 }];
            }
        });
        setTicketTotal(prevTotal => prevTotal + priceNum);
    }

    function removeItem(index) {
        const item = ticketItems[index];
        const amount = item.price * item.qty;
        setTicketItems(prev => prev.filter((_, i) => i !== index));
        setTicketTotal(prev => prev - amount);
        setSelectedItemIndex(null);
    }

    function adjustQty(index, delta) {
        setTicketItems(prev => {
            const item = prev[index];
            const newQty = item.qty + delta;
            if (newQty <= 0) {
                // Remove item if quantity goes to 0 or below
                setSelectedItemIndex(null);
                return prev.filter((_, i) => i !== index);
            } else {
                // Update quantity and total
                return prev.map((it, i) => i === index ? { ...it, qty: newQty } : it);
            }
        });
        const item = ticketItems[index];
        setTicketTotal(prevTotal => prevTotal + (item.price * delta));
    }

    function sendTicketItems() {
        fetch("https://script.google.com/macros/s/AKfycbyfYo-rxtVEBPbnmKf1AWYBghlzZ8WkFgbzrj8Zc82wNQT1PuRyzeWQjPsu2YN2q4BP1Q/exec", {
            method: "POST",
            mode: 'cors', // Required for cross-origin requests
            headers: {
                "Content-Type": 'text/plain;charset=utf-8' 
            },
            body: JSON.stringify({
                items: ticketItems
            })
        })
    }

    function resetTicket() {
        console.log(ticketItems)
        setTicketItems([]);
        setTicketTotal(0);
        setSelectedItemIndex(null);
        setShowCashPad(false);
        setPaymentEntered(false);
    }

    function orderItemsForColumns(items, columns = 3) {
        const ordered = [];
        if (!items || items.length === 0) return ordered;

        const total = items.length;
        const baseCount = Math.floor(total / columns);
        const extra = total % columns;
        const columnsData = [];

        let cursor = 0;
        for (let col = 0; col < columns; col++) {
            const count = baseCount + (col < extra ? 1 : 0);
            columnsData[col] = items.slice(cursor, cursor + count);
            cursor += count;
        }

        const maxRows = Math.max(...columnsData.map(colItems => colItems.length));
        for (let row = 0; row < maxRows; row++) {
            for (let col = 0; col < columns; col++) {
                if (columnsData[col][row] !== undefined) ordered.push(columnsData[col][row]);
            }
        }

        return ordered;
    }

    const departmentItems = props.sheetData.filter(t => t.Department === radioValue);
    const orderedDepartmentItems = orderItemsForColumns(departmentItems, 3);
    console.log(ticketItems);

    return (
    
    <Container>
        <Row>
        <Col lg={3} style={{backgroundColor: "white", height: "90vh"}}>
            <Row style={{borderBottomColor: "black", borderBottomStyle: "solid", height: "5vh"}}>
                <h1 style={{fontSize: 25, textAlign: "center", marginTop: "1vh"}}>Ticket</h1>
            </Row>
            <Row style={{height: selectedItemIndex !== null ? "70vh" : "77.5vh", overflowY: "scroll"}}> 
                <Col>

                {/* This is the ticket on the left. It maps the current ticket with name, quantity, and price. */}
                {/* TODO: Refactor this to add modifiers under each item instead of as separate items on the ticket. */}
                {
                    ticketItems.map((item, index) => 
                        <Row key={index}>
                            <Button variant={selectedItemIndex === index ? "primary" : "outline-primary"} onClick={() => {setSelectedItemIndex(index); item.department == "Liquor" ? setModifierScreen("liquorModifiers") : item.department == "Mixers" ? setModifierScreen("mixerModifiers") : setModifierScreen(null) }} style={{width: "100%", borderRadius: "10px", border: "none", margin: 0, color: selectedItemIndex === index ? "white" : "black"}}>
                                <Row>
                                <Col xs="auto" sm="auto" md="auto" lg="auto" xl="auto" style={{marginLeft: "5%", padding: 0}}>
                                    <p style={{margin: 0, padding: 0, fontSize: 17}}>{item.name}</p>
                                </Col>
                                <Col>
                                    <Card bg={selectedItemIndex === index ? "light" : "primary"} text={selectedItemIndex === index ? "dark" : "white"} style={{border: "none", width: 'fit-content', textAlign: "center"}}>
                                        <p style={{margin: "0px 10px 0px 10px", fontSize: 16}}>{item.qty}</p>
                                    </Card>
                                </Col>
                                <Col sm={3} style={{marginRight: "5%", padding: 0}}>
                                    <p style={{margin: 0, padding: 0, width: "auto", textAlign: "right", fontSize: 17}}>${(item.price * item.qty).toFixed(2)}</p>
                                </Col>
                                </Row>
                            </Button>
                        </Row>
                    )
                }
                </Col>
            </Row>

            {/* This is the ticket item controls at the bottom of the ticket. It shows remove item, adjust quantity, and clear ticket options. */}
            {selectedItemIndex !== null && (
                <Row style={{height: "7.5vh"}} className="align-items-center">
                    <Col style={{padding: 0}}>
                        <Button variant="outline-warning" style={{width: "60%", fontSize: 20, marginLeft: "2.5%", marginRight: "2.5%"}} onClick={() => { if (selectedItemIndex !== null) removeItem(selectedItemIndex); }}>Remove Item</Button>
                        <Button size="sm" variant="outline-primary" onClick={() => adjustQty(selectedItemIndex, -1)} style={{marginRight: "2.5%", fontSize: 20, width: "15%"}}>-</Button>
                        <Button size="sm" variant="outline-primary" onClick={() => adjustQty(selectedItemIndex, 1)} style={{fontSize: 20, width: "15%"}}>+</Button>
                    </Col>
                </Row>
            )}
            <Row style={{height: "7.5vh", textAlign: "center"}} className="align-items-center">
                {ticketTotal > 0 && (
                    <Col style={{padding: 0}}>
                        <Button variant="outline-danger" style={{width: "95%", fontSize: 20}} onClick={() => {setTicketItems([]); setTicketTotal(0); setSelectedItemIndex(null);}}>Clear Ticket</Button>
                    </Col>
                )}
            </Row>
        </Col>

        {/* This is the department selector in the middle column.
            It maps all departments from the google sheet and allows the user to select which department they want to view items for.
            It also has an "Open" option that shows all items for all departments and allows the user to manually enter a price for open items. */}
        <Col lg={2}>
            {
                props.departments.map((department, index) => 
                    <ToggleButton
                        key={index}
                        id={`radio-${index}`}
                        type="radio"
                        name="radio"
                        value={department}
                        checked={radioValue === department}
                        onChange={(e) => {setRadioValue(department)}}
                        style={{fontSize: 20, padding: "1.5vh", width: "95%", borderRadius: "5px", textAlign: "center", backgroundColor: radioValue === department ? "#0073FF" : "white", border: "none", marginTop: "1.5vh", color: radioValue === department ? "white" : "black"}}
                        onClick={() => setModifierScreen(null)}
                    >
                        {department}
                    </ToggleButton>  
                )
            }
            <ToggleButton
                key={"Open"}
                id={`radio-Open`}
                type="radio"
                variant={radioValue === "Open" ? 'primary' : 'light'}
                name="radio"
                value={"Open"}
                checked={radioValue === "Open"}
                onChange={(e) => {setRadioValue("Open"); setModifierScreen(null);}}
                style={{fontSize: 20, width: "95%", padding: "1.5vh", borderRadius: "5px", textAlign: "center", backgroundColor: radioValue === "Open" ? "#0073FF" : "white", border: "none", marginTop: "1.5vh", color: radioValue === "Open" ? "white" : "black"}}
            >
                Open
            </ToggleButton>  
        </Col>


        {/* This is the item selection column on the right.
            It maps all items for the selected department and allows the user to add them to the ticket by clicking on them. */}
        <Col lg={7} style={{height: "90vh", overflow: "auto"}}>
        
            { radioValue !== 'Open' && modifierScreen == null ?
                <Row className="g-3" style={{marginTop: "1vh"}}>
                    {orderedDepartmentItems.map(c => 
                        <Col key={c.Name} xs={12} md={4} lg={4} xl={4} xxl={4} style={{padding: ".25vw", marginTop: ".25vh"}}>
                            <button onClick={() => {addItem(c.Name, c.Price); setModifierScreen(c.Department == "Liquor" ? "liquorModifiers" : c.Department == "Mixers" ? "mixerModifiers" : null); setCurrentTicketItem(c);}} style={{width: "100%", borderRadius: "5px", textAlign: "center", backgroundColor: c.buttonColor, border: "none"}}>
                                <Card style={{border: "none", backgroundColor: "transparent", color: "white", paddingBottom: "1.75vh", paddingTop: "2vh"}}>
                                    <Card.Title style={{fontSize: 20}}>{c.Name}</Card.Title>
                                </Card>
                            </button>
                        </Col>
                    )}
                </Row>
            : modifierScreen == null ?
                <CashPinPad addItem={addItem} setRadioValue={setRadioValue}/>
            :
                <></>
            }

            {/* TODO: Implement Row choice */}
            {/*Modifiers for Liquor and Mixers. Shows up when a liquor or mixer item is selected on the ticket and allows the user to add modifiers to those items. */}
            { modifierScreen == 'liquorModifiers' ?
                <Row style={{height: "100%"}}>
                    <Col xs={4} style={{padding: 0, marginTop: "1vh"}}>
                        {props.modifiers.filter(t => t.Department === "Liquor").map(c => 
                            <Row key={c.Modifier_Name} style={{padding: ".25vw", marginTop: ".25vh"}}>
                                <button onClick={() => addModifier(c.Modifier_Name, c.Price)} style={{width: "100%", borderRadius: "5px", textAlign: "center", backgroundColor: c.buttonColor, border: "none"}}>
                                    <Card style={{border: "none", backgroundColor: "transparent", color: "white", paddingBottom: "1.75vh", paddingTop: "2vh"}}>
                                        <Card.Title style={{fontSize: 20}}>{c.Modifier_Name}</Card.Title>
                                    </Card>
                                </button>
                            </Row>
                        )}
                    </Col>
                
                    <Col xs={8} style={{display: "flex", justifyContent: "flex-end", alignItems: "flex-end", paddingTop: ".25vh"}}>
                        <Button variant="outline-light" style={{width: "200px", height: "auto", padding: "0.75rem 1rem", marginBottom: "1vh", fontSize: 50}} onClick={() => setModifierScreen(null)}>X</Button>
                    </Col>
                </Row>
                
            : modifierScreen == 'mixerModifiers' ?
                <Row style={{height: "100%"}}>
                    <Col xs={4} style={{padding: 0, marginTop: "1vh"}}>
                        {props.modifiers.filter(t => t.Department === "Mixers").map(c => 
                            <Row key={c.Modifier_Name} style={{padding: ".25vw", marginTop: ".25vh"}}>
                                <button onClick={() => addModifier(c.Modifier_Name, c.Price)} style={{width: "100%", borderRadius: "5px", textAlign: "center", backgroundColor: c.buttonColor, border: "none"}}>
                                    <Card style={{border: "none", backgroundColor: "transparent", color: "white", paddingBottom: "1.75vh", paddingTop: "2vh"}}>
                                        <Card.Title style={{fontSize: 20}}>{c.Modifier_Name}</Card.Title>
                                    </Card>
                                </button>
                            </Row>
                        )}
                    </Col>
                
                    <Col xs={8} style={{display: "flex", justifyContent: "flex-end", alignItems: "flex-end", paddingTop: ".25vh"}}>
                        <Button variant="outline-light" style={{width: "200px", height: "auto", padding: "0.75rem 1rem", marginBottom: "1vh", fontSize: 50}} onClick={() => setModifierScreen(null)}>X</Button>
                    </Col>
                </Row>
    
            :
                <> </>
            }
        </Col>
        </Row> {/* End of main row containing ticket, department selector, and item selector */}


        {/* This is the bottom row that contains the total and the pay button.
            The pay button opens the cash pin pad modal when clicked. */}
        <Row style={{backgroundColor: "black", height: "7vh"}}>
            <Col style={{textAlign: "left", color: "white", fontSize: 45}}>
				<p style={{margin: 0}}>Total: ${ticketTotal.toFixed(2)}</p>
			</Col>
			<Col style={{textAlign: "right", color: "white"}}>
				<Button variant="light" style={{width: "200px", height: "5vh", marginTop: "1vh", fontSize: 30, paddingTop: "0px"}} onClick={() => setShowCashPad(true)}>Pay</Button>
			</Col>
        </Row>


        {/* This is the cash pin pad modal and change models.
            It shows the cash pin pad when the pay button is clicked and then shows the change due after payment is entered. */}
        <Modal show={showCashPad && !paymentEntered} onHide={() => setShowCashPad(false)} centered>
            <Modal.Body style={{backgroundColor: "#323131"}}>
                <PaymentPinPad setPaymentEntered={setPaymentEntered} paymentEntered={paymentEntered} setCashGiven={setCashGiven} sendTicketItems={sendTicketItems}/>
            </Modal.Body>
        </Modal>
        <Modal show={showCashPad && paymentEntered} onHide={() => resetTicket()} centered>
            <Modal.Body style={{backgroundColor: "#323131"}}>
                <h1 style={{color: "white", textAlign: "center"}}>Change Due</h1>
                <h1 style={{color: "white", textAlign: "center"}}>${(parseFloat(cashGiven) - ticketTotal).toFixed(2)}</h1>
                <Button variant="light" style={{width: "100%", height: "5vh", marginTop: "1vh"}} onClick={() => resetTicket()}>Done</Button>
            </Modal.Body>
        </Modal>
    </Container>
    );
};
export default Ticket;


