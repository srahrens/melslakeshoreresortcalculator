import { useState, useEffect } from 'react'
import {Card, Container, Button, Row, Col} from 'react-bootstrap';
import './App.css'

function App() {
  const [sheetData, setSheetData] = useState([]); // All data from google sheet
  const [departments, setDepartments] = useState([]); // All departments listed in sheet
  const [currentTab, setCurrentTab] = useState(); // The current tab the user is on

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
  

  console.log(departments);

  return (
    <Container fluid>
      <Row>
        <Col lg={3} style={{backgroundColor: "blue"}}>
        </Col>
        <Col lg={2} style={{backgroundColor: "red"}}>
        </Col>
          <Col md={6} lg={7}>
              <Container fluid>
                  <Row>
                      {
                          sheetData.map(c => <Col key={c.Name} lg={6}>
                              <Card><Card.Title>{c.Name}</Card.Title></Card>
                          </Col>)
                      }
                  </Row>
              </Container>
          </Col>
      </Row>
  </Container>
  )
}

export default App
