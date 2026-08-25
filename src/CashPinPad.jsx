import React, { useState } from 'react';
import { Button, Container, Row, Col, Card, Form } from 'react-bootstrap';
import {CurrencyInput, formatValue} from 'react-currency-input-field';

/**
 * Numeric keypad shown under the "Open" department for manually pricing an item
 * (e.g. a pour that doesn't have a fixed sheet price). Submitting adds an
 * "Open Liquor" line to the ticket with the entered price.
 *
 * @param {Object} props
 * @param string name props.name - what the item will be label as on the ticket
 * @param {(name: string, price: string) => void} props.addItem - Callback (from {@link ../Ticket.jsx}) that adds the priced item to the ticket.
 * @param {(department: string) => void} props.setRadioValue - Unused here; passed through from the parent's department selector state.
 * @returns {JSX.Element} The price display and numeric keypad.
 */
function CashPinPad(props) {
	const [amount, setAmount] = useState('');
	const maxLength = 6;
    const [decimalAdded, setDecimalAdded] = useState(false);
    const [decimalLength, setDecimalLength] = useState(2);

	/**
	 * Appends a digit (or decimal point) to the entered price, respecting the
	 * max length and limiting input to two digits after the decimal point.
	 *
	 * @param {number|string} digit - The digit (0-9) or `'.'` that was pressed.
	 * @returns {void}
	 */
	const addDigit = (digit) => {
		if (amount.length < maxLength) {
            if (digit === '.') {
                setDecimalAdded(true);
                setAmount(prev => prev + digit);
            } else if (decimalAdded == true && decimalLength != 0) {
                setDecimalLength(prev => prev - 1);
                setAmount(prev => prev + digit);
            } else if (decimalAdded == false) {
                setAmount(prev => prev + digit);
            }
		}
	};

	/**
	 * Removes the last character of the entered price and rolls back the decimal
	 * tracking state to match.
	 *
	 * @returns {void}
	 */
	const deleteDigit = () => {
		setAmount(prev => prev.slice(0, -1));
        if (decimalAdded == true && decimalLength !=2) {
            setDecimalLength(prev => prev + 1);
        } else if (decimalLength == 2) {
            setDecimalAdded(false);
        }
	};

	/**
	 * Builds the 1-9 digit buttons for the keypad.
	 *
	 * @returns {JSX.Element[]} One `<Col>` per digit 1-9.
	 */
	const renderButtons = () => {
		return [1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
			<Col xs={4} key={digit}>
			<Button 
				variant="outline-light" 
				style={{width: "90%", aspectRatio: "1/1", marginBottom: "10%", fontSize: 50, marginRight: "5%", marginLeft: "5%"}}
				onClick={() => addDigit(digit)}
			>
				{digit}
			</Button>
			</Col>
		));
	};

	return (
	<Container fluid>
		<Row>
			<Col md={2}></Col>
			<Col md={8}>
				<Card style={{backgroundColor: "transparent", border: "none"}}>
				<Card.Body style={{padding: 0}}>
					<Row>
                        <CurrencyInput
                            readOnly
                            id="input-cash"
                            name="input-cash"
                            placeholder="$0.00"
                            defaultValue={0}
                            value={amount}
                            decimalsLimit={2}
                            maxLength={5}
                            prefix={'$'}
                            style={{textAlign: "center", height: "7vh", backgroundColor: "transparent", color: "white", fontSize: 30, width: "92%", margin: "4%", borderRadius: "5px", borderColor: "white", borderWidth: "1px", borderStyle: "solid"}}
                        />
					</Row>
					<Row>
                        {renderButtons()}
                        <Col xs={4}><Button variant="outline-danger" style={{width: "90%", aspectRatio: "1/1", fontSize: 50, marginRight: "5%", marginLeft: "5%"}} onClick={deleteDigit}>⌫</Button></Col>
                        <Col xs={4}><Button variant="outline-light" style={{width: "90%", aspectRatio: "1/1", fontSize: 50, marginRight: "5%", marginLeft: "5%"}} onClick={() => addDigit(0)}>0</Button></Col>
                        <Col xs={4}><Button variant="outline-light" style={{width: "90%", aspectRatio: "1/1", fontSize: 30, marginRight: "5%", marginLeft: "5%"}} onClick={() => addDigit('.')}>.</Button></Col>
					</Row>
                    <Row>
                        <Button variant="outline-success" style={{marginTop: "5%", width: "95%", fontSize: 30, marginRight: "2.5%", marginLeft: "2.5%"}} onClick={() => { if (parseFloat(amount) > 0) { props.addItem(props.name, `$${amount}`); setAmount(''); } }}>Add Item</Button>
                    </Row>
				</Card.Body>
				</Card>
			</Col>
			<Col md={2}></Col>
		</Row>
	</Container>
	);
};

export default CashPinPad;
