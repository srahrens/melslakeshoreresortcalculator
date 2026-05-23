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
		fetch("https://opensheet.elk.sh/1_hdFkBTCwqWiRa8Tkx2huEamIMqg5bRjTCOYV30xK1s/items%20and%20prices")
		.then(res => res.json())
		.then(data => {
			setSheetData(data);
			isBandHere(data);
			let uniqueDepartments = data.filter((obj, index, self) =>
			index === self.findIndex((t) => t.Department === obj.Department)
			);
			setDepartments(uniqueDepartments.map(item => item.Department));
		})
	}

	// Finish this function to get modifiers list from google sheet and set it to state
	function getModifersList() {
		fetch("https://opensheet.elk.sh/1_hdFkBTCwqWiRa8Tkx2huEamIMqg5bRjTCOYV30xK1s/modifiers")
		.then(res => res.json())
		.then(data => {
			console.log(data);

		})
	}

	function parse12HourTime(date, timeString) {
		if (!timeString) return null;
		const normalized = timeString.toString().trim().toUpperCase().replace(/\./g, '');
		const ampmMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
		let hour, minute;

		if (ampmMatch) {
			hour = Number(ampmMatch[1]);
			minute = Number(ampmMatch[2] || '00');
			const period = ampmMatch[3];

			if (period === 'PM' && hour !== 12) hour += 12;
			if (period === 'AM' && hour === 12) hour = 0;
		} else {
			const twentyFourMatch = normalized.match(/^(\d{1,2}):?(\d{2})$/);
			if (!twentyFourMatch) return null;
			hour = Number(twentyFourMatch[1]);
			minute = Number(twentyFourMatch[2]);
		}

		const parsed = new Date(date);
		parsed.setHours(hour, minute, 0, 0);
		return parsed;
	}

	function isBandHere(data) {
		const parsePriceValue = value => {
			const cleaned = String(value).replace(/[^0-9.-]+/g, '');
			return Number(cleaned) || 0;
		};

		fetch("https://opensheet.elk.sh/1_hdFkBTCwqWiRa8Tkx2huEamIMqg5bRjTCOYV30xK1s/band%20upcharge")
		.then(res => res.json())
		.then(bandData => {
			const now = new Date();
			let updatedData = data;
			bandData.forEach(entry => {
				entry.date = new Date(entry.date);
				entry.startTime = parse12HourTime(entry.date, entry.startTime);
				entry.endTime = parse12HourTime(entry.date, entry.endTime);
				if (now.getFullYear() === entry.date.getFullYear() && now.getMonth() === entry.date.getMonth() && now.getDate() === entry.date.getDate()) {
					const bandIsPresent = (now >= entry.startTime && now <= entry.endTime && entry.overnight === "FALSE")
						|| ((now >= entry.startTime || now <= entry.endTime) && entry.overnight === "TRUE");
					if (bandIsPresent) {
						updatedData = updatedData.map(item => {
							if (item.Department === "Snacks & Pop") {
								return item;
							}
							return {
								...item,
								Price: `$${(parsePriceValue(item.Price) + 0.5).toFixed(2)}`
							};
						});
					}
				}
			});
			setSheetData(updatedData);
		})
	}

	return (
	<Container fluid style={{backgroundColor: "#323131"}}>
		<Row style={{height: "3vh", backgroundColor: "black"}}>
			<Col style={{textAlign: "left", color: "white"}}>
				<p>Shed Cash Drawer</p>
			</Col>
			<Col style={{textAlign: "right", color: "white"}}>
				<p>Mel's Lakeshore Resort</p>
			</Col>
		</Row>
		<Row style={{height: "97vh"}}>
			{login == false ?
				<LoginPinPad login={login} setLogin={setLogin}/>
				:
				<Ticket sheetData={sheetData} departments={departments}/>
			}
		</Row>
	</Container>
	)
}

export default App;
