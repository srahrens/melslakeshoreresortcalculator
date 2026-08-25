import { useState, useEffect, useRef } from 'react'
import {Card, Container, Button, Row, Col, ToggleButton, Modal} from 'react-bootstrap';
import './App.css'
import CashPinPad from './CashPinPad.jsx';
import PaymentPinPad from './PaymentPinPad.jsx';

const GAS_URL = "https://script.google.com/macros/s/AKfycbyfYo-rxtVEBPbnmKf1AWYBghlzZ8WkFgbzrj8Zc82wNQT1PuRyzeWQjPsu2YN2q4BP1Q/exec";
const QUEUE_KEY = "melsPOS_pendingTickets";

// Tickets that failed to reach the sheet are queued here and retried automatically
// (on load, when the connection comes back, and on a timer) so a dropped connection
// in the shed doesn't silently lose a sale that was already rung up in cash.

/**
 * Reads the queue of tickets that failed to sync, from `localStorage`.
 *
 * @returns {Array<Object>} The queued ticket payloads (empty array if none, or if the stored value is corrupt).
 */
function loadQueue() {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
    } catch {
        return [];
    }
}

/**
 * Persists the queue of tickets that failed to sync, to `localStorage`.
 *
 * @param {Array<Object>} queue - The ticket payloads to store.
 * @returns {void}
 */
function saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Builds a short department abbreviation for the ticket-line badge, e.g. "Beer" -> "B",
 * "Snacks & Pop" -> "SP" (one letter per word, ignoring words with no letters like "&").
 *
 * @param {string} department - The department name (e.g. `item.department`).
 * @returns {string} The abbreviation, or `''` if `department` is falsy.
 */
function getDepartmentAbbreviation(department) {
    if (!department) return '';
    return department
        .split(/\s+/)
        .filter(word => /[A-Za-z]/.test(word))
        .map(word => word[0].toUpperCase())
        .join('');
}

/**
 * Parses a currency string like `"$8.00"` or `"-$50.00"` into a number. Prices from
 * the sheet come through as strings, so a direct `price > 0` comparison always fails
 * (the `$` breaks numeric coercion, e.g. `Number("$8.00")` is `NaN`) - strip the `$`
 * before parsing so the sign and digits parse correctly either way.
 *
 * @param {string} price - The price string, e.g. `"$8.00"` or `"-$50.00"`.
 * @returns {number} The numeric price (`NaN` if `price` isn't a parseable currency string).
 */
function parsePrice(price) {
    return parseFloat(String(price).replace('$', ''));
}

/**
 * Sends a single ticket payload to the Google Apps Script endpoint.
 *
 * @param {Object} payload - The ticket to send (id, items, total, timestamp).
 * @returns {Promise<boolean>} `true` if the request completed with an ok HTTP status, `false` on network failure or a non-ok response.
 */
async function postTicket(payload) {
    try {
        const res = await fetch(GAS_URL, {
            method: "POST",
            mode: 'cors', // Required for cross-origin requests
            headers: {
                "Content-Type": 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch (err) {
        console.error("Ticket sync failed, will retry:", err);
        return false;
    }
}

/**
 * The main POS screen: builds a ticket from department items and modifiers, totals it,
 * and takes a cash payment.
 *
 * @param {Object} props
 * @param {Array<Object>} props.sheetData - Item/price rows loaded from the Google Sheet (each row has at least `Name`, `Price`, `Department`, `buttonColor`).
 * @param {Array<string>} props.departments - Unique department names derived from `sheetData`, used to render the department selector buttons.
 * @param {Array<Object>} props.modifiers - Modifier rows loaded from the Google Sheet (each row has at least `Modifier_Name`, `Price`, `Department`, `buttonColor`).
 * @returns {JSX.Element} The ticket, department selector, item grid, and payment modals.
 */
function Ticket(props) {
    const [currentDepartment, setCurrentDepartment] = useState('Beer'); // for department selection
    const [modifierScreen, setModifierScreen] = useState(null); // for modifier selection screen
    const [currentTicketItem, setCurrentTicketItem] = useState(null); // for tracking which ticket item is being modified when modifiers are being added
    const [ticketItems, setTicketItems] = useState([]);
    const [ticketTotal, setTicketTotal] = useState(0);
    const [selectedItemIndex, setSelectedItemIndex] = useState(null); // for ticket item selection and modification
    const [showCashPad, setShowCashPad] = useState(false);
    const [paymentEntered, setPaymentEntered] = useState(false);
    const [cashGiven, setCashGiven] = useState(0);
    const [pendingSyncCount, setPendingSyncCount] = useState(() => loadQueue().length);
    const isSendingRef = useRef(false);

    /**
     * Tries to (re)send every ticket in the failed-sync queue. Whichever tickets still
     * fail are kept in the queue for the next attempt; `pendingSyncCount` is updated to match.
     *
     * @returns {Promise<void>}
     */
    async function flushQueue() {
        let queue = loadQueue();
        if (queue.length === 0) return;

        const stillPending = [];
        for (const payload of queue) {
            const success = await postTicket(payload);
            if (!success) stillPending.push(payload);
        }
        saveQueue(stillPending);
        setPendingSyncCount(stillPending.length);
    }

    useEffect(() => {
        flushQueue();
        window.addEventListener('online', flushQueue);
        const interval = setInterval(flushQueue, 30000);
        return () => {
            window.removeEventListener('online', flushQueue);
            clearInterval(interval);
        };
    }, []);


    // TODO: Refactor this to add modifiers under each item instead of as separate items on the ticket.
    /**
     * Adds an item to the ticket, or increments its quantity if it's already on the
     * ticket. "Open Liquor" (manually-priced) entries are always added as a new line
     * rather than merged, since each one can have a different price.
     *
     * @param {string} name - The item's display name (matched against existing ticket lines).
     * @param {string} price - The item's price as a currency string, e.g. `"$4.00"`.
     * @returns {void}
     */
    function addItem(name, price) {
        let priceNum = parseFloat(price.slice(1));
        if (name === 'Open Liquor') {
            // Always a new line (each Open Liquor entry can have a different price), so it always lands at the end.
            setSelectedItemIndex(ticketItems.length);
            setTicketItems(prevItems => {
                return [...prevItems, { name, department: currentDepartment, price: priceNum, qty: 1, id: Date.now(), mods: []}];
            });
        } else {
            const existingIndex = ticketItems.findIndex(item => item.name === name);
            setSelectedItemIndex(existingIndex !== -1 ? existingIndex : ticketItems.length);
            setTicketItems(prevItems => {
                const existingItem = prevItems.find(item => item.name === name && item.mods.length === 0);
                if (existingItem) {
                    // Increment quantity if item already exists
                    return prevItems.map(item =>
                        item.name === name ? { ...item, qty: item.qty + 1 } : item
                    );
                } else {
                    // Add new item with quantity 1
                    return [...prevItems, { name, id: `${name}-${Date.now()}`, department: currentDepartment, price: priceNum, qty: 1, mods: [] }];
                }
            });
        }
        setTicketTotal(prevTotal => prevTotal + priceNum);
    }

    /**
     * Adds a modifier (e.g. a liquor/mixer add-on) to the ticket, or increments its
     * quantity if it's already on the ticket.
     *
     * @param {string} name - The modifier's display name (matched against existing ticket lines).
     * @param {string} price - The modifier's price as a currency string, e.g. `"$0.50"`.
     * @returns {void}
     */
    function addModifier(name, price) {
        console.log(name, price)
        let priceNum = parseFloat(price.slice(1));
        setTicketItems(prevItems => {
            const existingItem = prevItems[selectedItemIndex];
            if (existingItem) {
                // Add Modifier to item
                return prevItems.map((item, index) =>
                    index == selectedItemIndex ? { ...item, mods: [...item.mods, {"name": name, "price": price}] } : item
                );
            }
        });
        setTicketTotal(prevTotal => prevTotal + priceNum);
        console.log(ticketItems)
    }

    /**
     * Sums the price of every modifier attached to a ticket line.
     *
     * @param {Object} item - A ticket line item (with a `mods` array of `{ name, price }`, price as a currency string like `"$0.50"`).
     * @returns {number} The total modifier price for the line (0 if it has no modifiers).
     */
    function getModsTotal(item) {
        return item.mods.reduce((sum, mod) => sum + parseFloat(mod.price.slice(1)), 0);
    }

    /**
     * Removes a ticket line entirely and subtracts its full line total - (item price
     * plus any attached modifier prices) times quantity - from the ticket total.
     *
     * @param {number} index - Index into `ticketItems` of the line to remove.
     * @returns {void}
     */
    function removeItem(index) {
        const item = ticketItems[index];
        const amount = (item.price + getModsTotal(item)) * item.qty;
        setTicketItems(prev => prev.filter((_, i) => i !== index));
        setTicketTotal(prev => prev - amount);
        setSelectedItemIndex(null);
    }

    /**
     * Adjusts a ticket line's quantity by `delta` and updates the ticket total to match,
     * scaling any attached modifier prices along with the item price (a modifier applies
     * per unit, so each +/- of quantity adds/removes one unit's worth of modifiers too).
     * If the resulting quantity would be zero or less, the line is removed instead.
     *
     * @param {number} index - Index into `ticketItems` of the line to adjust.
     * @param {number} delta - Amount to add to the current quantity (negative to decrease).
     * @returns {void}
     */
    function adjustQty(index, delta) {
        const item = ticketItems[index];
        const newQty = item.qty + delta;

        setTicketItems(prev => {
            if (newQty <= 0) {
                // Remove item if quantity goes to 0 or below
                setSelectedItemIndex(null);
                return prev.filter((_, i) => i !== index);
            } else {
                // Update quantity and total
                return prev.map((it, i) => i === index ? { ...it, qty: newQty } : it);
            }
        });

        const unitPrice = item.price + getModsTotal(item);
        setTicketTotal(prevTotal => prevTotal + unitPrice * delta);
    }

    /**
     * Sends the current ticket to the Google Apps Script endpoint. On failure, queues
     * the ticket in `localStorage` (via {@link saveQueue}) so {@link flushQueue} can
     * retry it later instead of the sale being lost.
     *
     * @returns {Promise<void>}
     */
    async function sendTicketItems() {
        if (isSendingRef.current) return; // guard against double-tap firing this twice for one ticket
        isSendingRef.current = true;

        // Creates a unique id for each sale and adds it and sale details to queue if there is an error in sending the ticket
        const payload = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            items: ticketItems,
            total: ticketTotal,
            timestamp: new Date().toISOString()
        };

        const success = await postTicket(payload);
        if (!success) {
            const queue = loadQueue();
            queue.push(payload);
            saveQueue(queue);
            setPendingSyncCount(queue.length);
        }
    }

    /**
     * Clears the ticket and closes the payment modals after a sale is completed (or
     * abandoned), returning the screen to a blank ticket.
     *
     * @returns {void}
     */
    function resetTicket() {
        console.log(ticketItems)
        setTicketItems([]);
        setTicketTotal(0);
        setSelectedItemIndex(null);
        setShowCashPad(false);
        setPaymentEntered(false);
        setModifierScreen(null);
        isSendingRef.current = false;
    }

    /**
     * Reorders a flat item list into row-major order for a multi-column grid, so that
     * mapping the result left-to-right/top-to-bottom fills columns evenly (rather than
     * filling one column at a time).
     *
     * @param {Array<Object>} items - Items to distribute across columns.
     * @param {number} [columns=3] - Number of columns to lay the items out into.
     * @returns {Array<Object>} `items` reordered so that rendering it in sequence fills the grid row by row.
     */
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

    const departmentItems = props.sheetData.filter(t => t.Department === currentDepartment);
    if (currentDepartment === "Liquor") {
        // Liquor items are shown lowest-price-first, with Rail always pinned to the very top.
        departmentItems.sort((a, b) => {
            if (a.Name === "Rail") return -1;
            if (b.Name === "Rail") return 1;
            return parsePrice(a.Price) - parsePrice(b.Price);
        });
    }
    const orderedDepartmentItems = orderItemsForColumns(departmentItems, 3);

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
                            <Button variant={selectedItemIndex === index ? "dark" : "outline-dark"}
                                    onClick={() => {
                                        if (selectedItemIndex === index) {
                                            setSelectedItemIndex(null);
                                            setModifierScreen(null);
                                        } else {
                                            setSelectedItemIndex(index);
                                            item.department == "Liquor" ? setModifierScreen("liquorModifiers") : item.department == "Mixers" ? setModifierScreen("mixerModifiers") : setModifierScreen(null);
                                        }
                                    }}
                                    className={`ticket-item-btn${selectedItemIndex === index ? ' selected' : ''}`} 
                                    style={{width: "98%", borderRadius: "3px", border: "none", margin: "1% 1% 0 1%"}}>
                                <Row className="align-items-center">
                                    <Col xs="auto" style={{marginLeft: "2%", padding: 0}}>
                                        <Card style={{backgroundColor: "#0073FF", borderRadius: "3px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center"}}>
                                            <Card.Text style={{margin: "0px 10px 0px 10px", color: "white", fontWeight: "bold", fontSize: 15}}>{getDepartmentAbbreviation(item.department)}</Card.Text>
                                        </Card>
                                    </Col>
                                    <Col xs="auto" sm="auto" md="auto" lg="auto" xl="auto" style={{marginLeft: "3%", padding: 0}}>
                                        <p style={{margin: 0, padding: 0, fontSize: 16}}>{item.name}</p>
                                    </Col>
                                    <Col>
                                        <p className={`ticket-item-qty`} style={{margin: 0, padding: 0, fontSize: 16, textAlign: "left"}}> x {item.qty}</p>
                                    </Col>
                                    <Col sm={2} style={{marginRight: "5%", padding: 0}}>
                                        <p style={{margin: 0, padding: 0, width: "auto", textAlign: "right", fontSize: 17}}>${(item.price * item.qty).toFixed(2)}</p>
                                    </Col>
                                </Row>
                                {item.mods.length > 0 ? 
                                    item.mods.map(mod => 
                                        <Row style={{textAlign: "left", marginLeft: "11%", marginRight: "2%"}}>
                                            <Col style={{margin: "0px", padding: "0px"}}>
                                                <p className={`ticket-item-mods${selectedItemIndex === index ? ' selected' : ''}`} style={{margin: "0px"}}>{mod.name}</p>
                                            </Col>
                                            <Col style={{margin: "0px", padding: "0px", textAlign: "right"}}>
                                                <p className={`ticket-item-mods${selectedItemIndex === index ? ' selected' : ''}`} style={{margin: "0px"}}>+ {mod.price}</p>
                                            </Col>
                                        </Row>
                                    )
                                    
                                :
                                    <></>
                                }
                                
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
                        <Button variant="outline-danger" style={{width: "95%", fontSize: 20}} onClick={() => resetTicket()}>Clear Ticket</Button>
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
                        checked={currentDepartment === department}
                        onChange={(e) => {setCurrentDepartment(department)}}
                        style={{fontSize: 20, padding: "1.5vh", width: "100%", borderRadius: "3px", textAlign: "center", backgroundColor: currentDepartment === department ? "#0073FF" : "white", border: "none", marginTop: "1.5vh", color: currentDepartment === department ? "white" : "black"}}
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
                variant={currentDepartment === "Open" ? 'primary' : 'light'}
                name="radio"
                value={"Open"}
                checked={currentDepartment === "Open"}
                onChange={(e) => {setCurrentDepartment("Open"); setModifierScreen(null);}}
                style={{fontSize: 20, width: "100%", padding: "1.5vh", borderRadius: "3px", textAlign: "center", backgroundColor: currentDepartment === "Open" ? "#0073FF" : "white", border: "none", marginTop: "1.5vh", color: currentDepartment === "Open" ? "white" : "black"}}
            >
                Open
            </ToggleButton>  
        </Col>


        {/* This is the item selection column on the right.
            It maps all items for the selected department and allows the user to add them to the ticket by clicking on them. */}
        <Col lg={7} style={{height: "90vh", overflow: "auto", padding: "0% 1% 0% 0%"}}>
        
            { currentDepartment !== 'Open' && modifierScreen == null ?
                currentDepartment === 'Liquor' ?
                    // Liquor items are shown as a single stacked column, same layout as the modifier lists.
                    <Row style={{height: "100%"}}>
                        <Col xs={4} style={{padding: 0, marginTop: "1vh"}}>
                            {departmentItems.map(c =>
                                <Row key={c.Name} style={{margin: "1.25vh 0vh 0vh 0vh"}}>
                                    <Button onClick={() => {
                                        if (parsePrice(c.Price) > 0) {
                                            addItem(c.Name, c.Price);
                                            setModifierScreen("liquorModifiers");
                                            setCurrentTicketItem(c);
                                            setSelectedItemIndex(ticketItems.length);
                                        } else {
                                            setModifierScreen(parsePrice(c.Price) < 0 ? "dynamicItem" : "liquorModifiers");
                                            setCurrentTicketItem(c);
                                        }
                                    }} style={{marginLeft: "5%", width: "95%", borderRadius: "3px", textAlign: "center", backgroundColor: c.buttonColor, border: "none", padding: "1.75vh 0 2vh 0", fontSize: 20}}>
                                        {c.Name}
                                    </Button>
                                </Row>
                            )}
                        </Col>
                    </Row>
                :
                    <Row style={{paddingTop: "1vh", width: "100%", margin:"0px"}}>
                        {orderedDepartmentItems.map(c =>
                            (parsePrice(c.Price) > 0 ?
                                // Item has a price so no pin pad is used
                                <Col key={c.Name} xs={12} md={4} lg={4} xl={4} xxl={4} style={{padding: ".25vw", marginTop: ".25vh"}}>
                                    <button onClick={() => {addItem(c.Name, c.Price); setModifierScreen(c.Department == "Mixers" ? "mixerModifiers" : null); setCurrentTicketItem(c); setSelectedItemIndex(ticketItems.length)}} style={{width: "100%", borderRadius: "3px", textAlign: "center", backgroundColor: c.buttonColor, border: "none"}}>
                                        <Card style={{border: "none", backgroundColor: "transparent", color: "white", paddingBottom: "1.75vh", paddingTop: "2vh"}}>
                                            <Card.Title style={{fontSize: 20}}>{c.Name}</Card.Title>
                                        </Card>
                                    </button>
                                </Col>
                            :
                                // Item's price is dynamic, we need a pin pad
                                <Col key={c.Name} xs={12} md={4} lg={4} xl={4} xxl={4} style={{padding: ".25vw", marginTop: ".25vh"}}>
                                    <button onClick={() => {setModifierScreen(c.Department == "Mixers" ? "mixerModifiers" : parsePrice(c.Price) < 0 ? "dynamicItem" : null); setCurrentTicketItem(c)}} style={{width: "100%", borderRadius: "3px", textAlign: "center", backgroundColor: c.buttonColor, border: "none"}}>
                                        <Card style={{border: "none", backgroundColor: "transparent", color: "white", paddingBottom: "1.75vh", paddingTop: "2vh"}}>
                                            <Card.Title style={{fontSize: 20}}>{c.Name}</Card.Title>
                                        </Card>
                                    </button>
                                </Col>
                            )
                        )}
                    </Row>
            : modifierScreen == null ?
                <CashPinPad name={"Open Liqour"} addItem={addItem} setCurrentDepartment={setCurrentDepartment}/>
            :
                <></>
            }

            {/*Modifiers for Liquor and Mixers. Shows up when a liquor or mixer item is selected on the ticket and allows the user to add modifiers to those items. */}
            { modifierScreen == 'liquorModifiers' ?
                <Row style={{height: "100%"}}>
                    <Col xs={4} style={{padding: 0, marginTop: "1vh"}}>
                        {props.modifiers.filter(t => t.Department === "Liquor").map(c =>
                            <Row key={c.Modifier_Name} style={{margin: "1.25vh 0vh 0vh 0vh"}}>
                                <Button onClick={() => addModifier(c.Modifier_Name, c.Price)} style={{marginLeft: "5%", width: "95%", borderRadius: "3px", textAlign: "center", backgroundColor: c.buttonColor, border: "none", padding: "1.75vh 0 2vh 0", fontSize: 20}}>
                                    {c.Modifier_Name}
                                </Button>
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
                            <Row key={c.Modifier_Name} style={{margin: "1.25vh 0vh 0vh 0vh"}}>
                                <Button onClick={() => addModifier(c.Modifier_Name, c.Price)} style={{marginLeft: "5%", width: "95%", borderRadius: "3px", textAlign: "center", backgroundColor: c.buttonColor, border: "none", padding: "1.75vh 0 2vh 0", fontSize: 20}}>
                                    {c.Modifier_Name}
                                </Button>
                            </Row>
                        )}
                    </Col>
                
                    <Col xs={8} style={{display: "flex", justifyContent: "flex-end", alignItems: "flex-end", paddingTop: ".25vh"}}>
                        <Button variant="outline-light" style={{width: "200px", height: "auto", padding: "0.75rem 1rem", marginBottom: "1vh", fontSize: 50}} onClick={() => setModifierScreen(null)}>X</Button>
                    </Col>
                </Row>
    
            : modifierScreen == 'dynamicItem' ?
                <CashPinPad name={currentTicketItem.Name} addItem={addItem} setCurrentDepartment={setCurrentDepartment}/>
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
			<Col style={{textAlign: "right", color: "white"}} className="align-items-center">
				{pendingSyncCount > 0 && (
					<span style={{color: "#ffc107", fontSize: 16, marginRight: "1vw"}}>
						⚠ {pendingSyncCount} unsynced
					</span>
				)}
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


