import { useState, useEffect } from 'react';
import {Card, Container, Button, Row, Col} from 'react-bootstrap';
import './App.css';
import LoginPinPad from './LoginPinPad.jsx';
import Ticket from './Ticket.jsx';

/**
 * Root component for the POS app. Loads the item/price list, department list, and
 * modifier list from the Google Sheet on mount, applies the band-upcharge price
 * adjustment, and renders the {@link Ticket} screen.
 *
 * @returns {JSX.Element} The app shell (header bar + ticket screen).
 */
function App() {
	const [sheetData, setSheetData] = useState([]); // All data from google sheet
	const [departments, setDepartments] = useState([]); // All departments listed in sheet
	const [modifiers, setModifiers] = useState([]); // All modifiers from google sheet

	useEffect(() => {
		getItemList();
		getModifersList();
	}, [])

	/**
	 * Fetches the "items and prices" sheet, stores it in state, derives the unique
	 * list of departments from it, and kicks off the band-upcharge check
	 * ({@link isBandHere}) against the freshly loaded data.
	 *
	 * @returns {void}
	 */
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

	/**
	 * Fetches the "modifiers" sheet (e.g. liquor/mixer add-ons) and stores it in state.
	 *
	 * @returns {void}
	 */
	function getModifersList() {
		fetch("https://opensheet.elk.sh/1_hdFkBTCwqWiRa8Tkx2huEamIMqg5bRjTCOYV30xK1s/modifiers")
		.then(res => res.json())
		.then(data => {
			setModifiers(data);
		})
	}

	/**
	 * Parses a time string in either 12-hour ("7:30 PM") or 24-hour ("19:30") form and
	 * returns a {@link Date} set to that time on the given day. Used to turn the band
	 * upcharge sheet's start/end time text into comparable Date objects.
	 *
	 * @param {Date|string|number} date - The calendar day the time applies to (year/month/day are kept; time is overwritten).
	 * @param {string} timeString - The time text to parse, e.g. "7:30 PM", "7 PM", or "19:30".
	 * @returns {Date|null} The parsed Date, or `null` if `timeString` is empty or doesn't match either format.
	 */
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

	/**
	 * Checks the "band upcharge" sheet for a live band event covering the current
	 * moment, and if one is active, adds $0.50 to every item's price except
	 * "Snacks & Pop" before storing the result as `sheetData`.
	 *
	 * @param {Array<Object>} data - The item/price list to (conditionally) apply the upcharge to, as loaded by {@link getItemList}.
	 * @returns {void}
	 */
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
			<Ticket sheetData={sheetData} departments={departments} modifiers={modifiers}/>
		</Row>
	</Container>
	)
}

export default App;
