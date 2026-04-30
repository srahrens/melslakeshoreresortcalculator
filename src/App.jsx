import { useState, useEffect } from 'react';
import {Card, Container, Button, Row, Col} from 'react-bootstrap';
import './App.css';
import LoginPinPad from './LoginPinPad.jsx';
import Ticket from './Ticket.jsx';

function App() {
	const [login, setLogin] = useState(false);
	const [sheetData, setSheetData] = useState([]); // All data from google sheet
	const [departments, setDepartments] = useState([]); // All departments listed in sheet

	useEffect(() => {
		getItemList();
	}, [])

	function getItemList() {
		fetch("https://opensheet.elk.sh/1_hdFkBTCwqWiRa8Tkx2huEamIMqg5bRjTCOYV30xK1s/1")
		.then(res => res.json())
		.then(data => {
			setSheetData(data);
			let uniqueDepartments = data.filter((obj, index, self) =>
			index === self.findIndex((t) => t.Department === obj.Department)
			);
			setDepartments(uniqueDepartments.map(item => item.Department));
		})
	}

	return (
	<Container fluid style={{backgroundColor: "#323131"}}>
		<Row style={{height: "3vh", backgroundColor: "black"}}>
			<Col style={{textAlign: "left", color: "white"}}>
				<p>Garage Cash Drawer</p>
			</Col>
			<Col style={{textAlign: "right", color: "white"}}>
				<p>Mel's Lakeshore Resort</p>
			</Col>
		</Row>
		<Row style={{height: "97vh"}}>
			{login == false ?
				<LoginPinPad login={login} setLogin={setLogin}/>
				:
				<Ticket sheetData={sheetData} departments={departments} />
			}
		</Row>
	</Container>
	)
}

export default App;
