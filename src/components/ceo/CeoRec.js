import React from 'react';
import { Search } from 'lucide-react';
import '../style/hr_style/Hr_Rec.css';

const CeoRec = () => {
  const employees = [
    { id: 1, name: 'John Doe', role: 'Staff', avatar: '👨‍💼' },
    { id: 2, name: 'Emily Smith', role: 'Manager', avatar: '👩‍💼' },
    { id: 3, name: 'Peter Brown', role: 'Contractor', avatar: '👨‍💼' },
    { id: 4, name: 'Jessica Lee', role: 'Technician', avatar: '👩‍💼' },
    { id: 5, name: 'Michael Wilson', role: 'Engineer', avatar: '👨‍💼' },
    { id: 6, name: 'Peter Brown', role: 'Contractor', avatar: '👨‍💼' },
    { id: 7, name: 'Jessica Lee', role: 'Technician', avatar: '👩‍💼' },
  ];

  const projects = ['Project A', 'Project B', 'Project C', 'Project D', 'Project E', 'Project F', 'Project G'];

  return (
    <div className="app-container">
      <header className="ceo-header">
          <div className="logo">
            <img src="/images/FadzLogo 1.png" alt="FadzTrack Logo" className="logo-img" />
            <h1>FadzTrack</h1>
          </div>
          <nav>
            <ul>
              <li><Link to="/cdash">Home</Link></li>
              <li><Link to="/cprojects">View Projects</Link></li>
              <li><Link to="/crecords">View Records</Link></li>
              <li><Link to="/cchat">Chat</Link></li>
            </ul>
          </nav>
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-btn">🔍</button>
          </div>
    </header>

      <main className="main-content">
        <div className="employee-records">
          <div className="records-header">
            <h2>Employee Movements Records</h2>
            <p>List of employee movements showing details</p>
          </div>
          
          <div className="records-container">
            {employees.map((employee, index) => (
              <div className="employee-record" key={employee.id}>
                <div className="employee-info">
                  <div className="avatar">{employee.avatar}</div>
                  <div className="employee-details">
                    <h3>{employee.name}</h3>
                    <p>{employee.role}</p>
                  </div>
                </div>
                
                <div className="project-info">
                  <h3>{projects[index]}</h3>
                  <p>From Project A</p>
                  <p className="date">1/2/2345</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CeoRec;