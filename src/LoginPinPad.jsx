import React, { useState } from 'react';
import { Button, Container, Row, Col, Card, Form } from 'react-bootstrap';

/**
 * PIN-entry login screen. Not currently rendered anywhere in the app (login was
 * removed from {@link ./App.jsx} — see the commit "Removed Login"); kept here in
 * case login is reintroduced.
 *
 * @param {Object} login - Props object (not destructured in the original code).
 * @param {(loggedIn: boolean) => void} login.setLogin - Called with `true` once the correct PIN is entered.
 * @returns {JSX.Element} The PIN display and numeric keypad.
 */
function LoginPinPad(login) {
	const [pin, setPin] = useState('');
	const maxLength = 4;
	const correctPin = "2916";

	/**
	 * Appends a digit to the entered PIN, up to `maxLength`.
	 *
	 * @param {number} digit - The digit (0-9) that was pressed.
	 * @returns {void}
	 */
	const addDigit = (digit) => {
		if (pin.length < maxLength) {
			setPin(prev => prev + digit);
		}
	};

	/**
	 * Removes the last digit of the entered PIN.
	 *
	 * @returns {void}
	 */
	const deleteDigit = () => {
		setPin(prev => prev.slice(0, -1));
	};

	/**
	 * Checks the entered PIN against the hardcoded correct PIN and logs in on a match.
	 *
	 * @returns {void}
	 */
	const checkPin = () => {
		if (pin === correctPin) {
			login.setLogin(true);
		}
	};

	// Generate buttons 1-9
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
