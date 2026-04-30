import { useState, useEffect } from 'react'
import {Card, Container, Button, Row, Col, ToggleButton, Modal} from 'react-bootstrap';
import './App.css'
import CashPinPad from './CashPinPad.jsx';
import PaymentPinPad from './PaymentPinPad.jsx';

function Ticket(props) {
    const [radioValue, setRadioValue] = useState('Beer');
    const [ticketItems, setTicketItems] = useState([]);
    const [ticketTotal, setTicketTotal] = useState(0);
    const [selectedItemIndex, setSelectedItemIndex] = useState(null);
    const [showCashPad, setShowCashPad] = useState(false);
    const [paymentEntered, setPaymentEntered] = useState(false);
    const [cashGiven, setCashGiven] = useState(0);
    
    function addItem(name, price) {
        let priceNum = parseFloat(price.slice(1));
        if (name === 'Open Liquor') {
            setTicketItems(prevItems => {
                return [...prevItems, { name, price: priceNum, qty: 1 }];
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
                    return [...prevItems, { name, price: priceNum, qty: 1 }];
                }
            });
        }
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

    function resetTicket() {
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
        console.log(ticketItems)
        setTicketItems([]);
        setTicketTotal(0);
        setSelectedItemIndex(null);
        setShowCashPad(false);
        setPaymentEntered(false);
    }

    return (
    <Container> 
        <Row>
            <Col lg={3} style={{backgroundColor: "white", height: "90vh"}}>
                <Row style={{borderBottomColor: "black", borderBottomStyle: "solid", height: "5vh"}}>
                    <h1 style={{fontSize: 25, textAlign: "center", marginTop: "1vh"}}>Ticket</h1>
                </Row>
                <Row style={{height: "70vh", overflowY: "scroll"}}> 
                    <Col>
                    {
                    ticketItems.map((item, index) => 
                            <Row key={index} style={{marginTop: "2%"}}>
                                <button onClick={() => setSelectedItemIndex(index)} style={{width: "100%", borderRadius: "10px", backgroundColor: selectedItemIndex === index ? "lightblue" : "white", border: "none"}}>
                                    <Row>
                                    <Col xs="auto" sm="auto" md="auto" lg="auto" xl="auto" style={{marginLeft: "5%", padding: 0}}>
                                        <p style={{margin: 0, padding: 0, fontSize: 17}}>{item.name}</p>
                                    </Col>
                                    <Col>
                                        <Card style={{border: "none", backgroundColor: "lightgrey", width: 'fit-content', textAlign: "center"}}>
                                            <p style={{margin: "0px 10px 0px 10px", fontSize: 16}}>{item.qty}</p>
                                        </Card>
                                    </Col>
                                    <Col sm={3} style={{marginRight: "5%", padding: 0}}>
                                        <p style={{margin: 0, padding: 0, width: "auto", textAlign: "right", fontSize: 17}}>${(item.price * item.qty).toFixed(2)}</p>
                                    </Col>
                                    </Row>
                                </button>
                            </Row>
                        )
                    }
                    </Col>
                </Row>
                <Row style={{height: "7.5vh"}} className="align-items-center">
                    {selectedItemIndex !== null && (
                        <>
                        <Col md={8}>
                            <Button variant="outline-warning" style={{width: "90%", fontSize: 20, marginLeft: "4%", paddingRight: "0px"}} onClick={() => { if (selectedItemIndex !== null) removeItem(selectedItemIndex); }}>Remove Item</Button>
                        </Col>
                        <Col md={4}>
                            <Button size="sm" variant="outline-secondary" onClick={() => adjustQty(selectedItemIndex, -1)} style={{marginRight: "10px", fontSize: 20, width: "40%"}}>-</Button>
                            <Button size="sm" variant="outline-secondary" onClick={() => adjustQty(selectedItemIndex, 1)} style={{fontSize: 20, width: "40%"}}>+</Button>
                        </Col>
                        </>
                    )}
                </Row>
                <Row style={{height: "7.5vh", textAlign: "center"}} className="align-items-center">
                    <Col>
                        <Button variant="outline-danger" style={{width: "95%", fontSize: 20}} onClick={() => {setTicketItems([]); setTicketTotal(0); setSelectedItemIndex(null);}}>Clear Ticket</Button>
                    </Col>
                </Row>
            </Col>
            <Col lg={2}>
                {
                    props.departments.map((department, index) => 
                        <ToggleButton
                            key={index}
                            id={`radio-${index}`}
                            type="radio"
                            variant={radioValue === department ? 'primary' : 'light'}
                            name="radio"
                            value={department}
                            checked={radioValue === department}
                            onChange={(e) => {setRadioValue(department)}}
                            style={{fontSize: 20, margin: "5%", width: "90%"}}
                        >
                            {department}
                        </ToggleButton>  
                    )
                }
            </Col>
            <Col lg={7} style={{height: "90vh", overflow: "auto"}}>
                <Row style={{paddingTop: "1vh", paddingRight: "1vh"}}>
                    { radioValue !== 'Open' ?
                        props.sheetData.filter(t => 
                            t.Department === radioValue
                        ).map(c => 
                            <Col key={c.Name} lg={4} xl={4} xxl={4} style={{padding: "1vh"}}>
                                <button onClick={() => addItem(c.Name, c.Price)} style={{width: "100%", borderRadius: "10px", textAlign: "left", backgroundColor: "white"}}>
                                <Card style={{border: "none"}}>
                                    <Card.Title style={{fontSize: 20}}>{c.Name}</Card.Title>
                                    <p style={{margin: 0}}>{c.Price}</p>
                                </Card>
                                </button>
                            </Col>
                        )
                        :
                        <CashPinPad addItem={addItem}/>
                    }
                </Row>
            </Col>
        </Row>
        <Row style={{backgroundColor: "black", height: "7vh"}}>
            <Col style={{textAlign: "left", color: "white", fontSize: 35}}>
				<p style={{margin: 0}}>Total: ${ticketTotal.toFixed(2)}</p>
			</Col>
			<Col style={{textAlign: "right", color: "white"}}>
				<Button variant="light" style={{width: "200px", height: "5vh", marginTop: "1vh"}} onClick={() => setShowCashPad(true)}>Pay</Button>
			</Col>
        </Row>
        <Modal show={showCashPad && !paymentEntered} onHide={() => setShowCashPad(false)} centered>
            <Modal.Body style={{backgroundColor: "#323131"}}>
                <PaymentPinPad setPaymentEntered={setPaymentEntered} paymentEntered={paymentEntered} setCashGiven={setCashGiven}/>
            </Modal.Body>
        </Modal>
        <Modal show={showCashPad && paymentEntered} onHide={() => setPaymentEntered(false)} centered>
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


