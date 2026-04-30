import React, { useState } from 'react';
import { Button, Container, Row, Col, Card, Form } from 'react-bootstrap';

function LoginPinPad(login) {
	const [pin, setPin] = useState('');
	const maxLength = 4;
	const correctPin = "1111";

	const addDigit = (digit) => {
		if (pin.length < maxLength) {
			setPin(prev => prev + digit);
		}
	};

	const deleteDigit = () => {
		setPin(prev => prev.slice(0, -1));
	};

	const checkPin = () => {
		if (pin === correctPin) {
			login.setLogin(true);
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
		<Row style={{textAlign: "center", color: "white", marginTop: "5vh"}}>
			<h1>Login</h1>
		</Row>
		<Row>
			<Col md={4}></Col>
			<Col md={4}>
				<Card style={{backgroundColor: "transparent", border: "none"}}>
				<Card.Body style={{padding: 0}}>
					<Row>
						<Form style={{width: "92%", margin: "4%"}}>
							<Form.Group as={Row} controlId="formPlaintextPassword">
   								<Form.Control readOnly type="password" value={pin} style={{textAlign: "center", height: "7vh", backgroundColor: "transparent", color: "white", fontSize: 30}}/>
       						</Form.Group>
						</Form>
					</Row>
					<Row>
					{renderButtons()}
					<Col xs={4}><Button variant="outline-danger" style={{width: "90%", aspectRatio: "1/1", fontSize: 50, marginRight: "5%", marginLeft: "5%"}} onClick={deleteDigit}>⌫</Button></Col>
					<Col xs={4}><Button variant="outline-light" style={{width: "90%", aspectRatio: "1/1", fontSize: 50, marginRight: "5%", marginLeft: "5%"}} onClick={() => addDigit(0)}>0</Button></Col>
					<Col xs={4}><Button variant="outline-success" style={{width: "90%", aspectRatio: "1/1", fontSize: 30, marginRight: "5%", marginLeft: "5%"}} onClick={checkPin}>Enter</Button></Col>
					</Row>
				</Card.Body>
				</Card>
			</Col>
			<Col md={4}></Col>
		</Row>
	</Container>
	);
};

export default LoginPinPad;
