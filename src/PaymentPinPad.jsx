import React, { useState } from 'react';
import { Button, Container, Row, Col, Card, Form } from 'react-bootstrap';
import {CurrencyInput, formatValue} from 'react-currency-input-field';

function CashPinPad(props) {
	const [amount, setAmount] = useState('');
	const maxLength = 6;
    const [decimalAdded, setDecimalAdded] = useState(false);
    const [decimalLength, setDecimalLength] = useState(2);

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

	const deleteDigit = () => {
		setAmount(prev => prev.slice(0, -1));
        if (decimalAdded == true && decimalLength !=2) {
            setDecimalLength(prev => prev + 1);
        } else if (decimalLength == 2) {
            setDecimalAdded(false);
        }
	};

	// Generate buttons 1-9
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
	<Container>
		<Row>
			<Col md={12}>
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
                        <Button variant="outline-success" style={{marginTop: "5%", width: "95%", fontSize: 30, marginRight: "2.5%", marginLeft: "2.5%"}} onClick={() => { props.setCashGiven(amount); props.setPaymentEntered(true); }}>Calculate Change</Button>
                    </Row>
				</Card.Body>
				</Card>
			</Col>
		</Row>
	</Container>
	);
};

export default CashPinPad;