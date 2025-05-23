import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import '../style/ceo_style/Ceo_Addproj.css';

const Ceo_Addproject = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projectManagers, setProjectManagers] = useState([]);
  const [pics, setPics] = useState([]);


  const [formData, setFormData] = useState({
    projectName: '',
    pic: [],
    contractor: '',
    budget: '',
    location: '',
    startDate: '',
    endDate: '',    
    manpower: '',
    projectmanager: ''
  });


  const handleChangeMultiplePics = (e) => {
  const options = e.target.options;
  const selectedPics = [];
  for (let i = 0; i < options.length; i++) {
    if (options[i].selected) {
      selectedPics.push(options[i].value);
    }
  }
  setFormData(prevState => ({
    ...prevState,
    pic: selectedPics
  }));
};


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    
    document.addEventListener("click", handleClickOutside);
    
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  useEffect(() => {
 const fetchUsers = async () => {
  try {
    const [pmRes, picRes] = await Promise.all([
      fetch('http://localhost:5000/api/users/role/Project%20Manager'),
      fetch('http://localhost:5000/api/users/role/Person%20in%20Charge')
    ]);

    const pmData = await pmRes.json();
    const picData = await picRes.json();

    console.log("PMs:", pmData);
    console.log("PICs:", picData);

    setProjectManagers(Array.isArray(pmData) ? pmData : pmData.data || []);
    setPics(Array.isArray(picData) ? picData : picData.data || []);
  } catch (err) {
    console.error('Failed to fetch users:', err);
  }
};

  fetchUsers();
}, []);


  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.startDate || !formData.endDate) {
      alert("Please select both start and end dates.");
      return;
    }
    
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      alert("End date cannot be before start date.");
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
  
      const result = await response.json();

      if (response.ok) {
        alert('✅ Project added successfully!');
        setFormData({
          projectName: '',
          pic: [],
          contractor: '',
          budget: '',
          location: '',
          startDate: '',
          endDate: '',
          manpower: '',
          projectmanager: ''
        });
        console.log('Form data:', formData);

      } else {
        alert(`❌ Error: ${result.message || 'Failed to add project'}`);
      }
  
    } catch (error) {
      console.error('❌ Submission error:', error);
      alert('❌ Failed to connect to server.');
    }
  };
  
  return (
    <div className="app-container">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
       <nav className="nav-menu">
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/requests" className="nav-link">Requests</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="search-profile">
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
          <div className="profile-menu-container">
            <div 
              className="profile-circle" 
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            >
              Z
            </div>
            
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="form-container">
          <h2 className="page-title">Add New Project</h2>
          
          <form onSubmit={handleSubmit} className="project-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="projectName">Project Name</label>
                <input
                  type="text"
                  id="projectName"
                  name="projectName"
                  placeholder="Enter project name"
                  value={formData.projectName}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
              <label htmlFor="pic">PIC</label>
             <select
                id="pic"
                name="pic"
                multiple
                value={formData.pic}
                onChange={handleChangeMultiplePics}
              >
                {pics.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            </div>


            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contractor">Contractor</label>
                <input
                  type="text"
                  id="contractor"
                  name="contractor"
                  placeholder="Enter contractor details"
                  value={formData.contractor}
                  onChange={handleChange}
                />
              </div>
              
                <div className="form-group">
                <label htmlFor="projectmanager">Project Manager</label>
                <select
                  id="projectmanager"
                  name="projectmanager"
                  value={formData.projectmanager}
                  onChange={handleChange}
                >
                  <option value="">-- Select Project Manager --</option>
                  {projectManagers.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>


              <div className="form-group">
                <label htmlFor="Budget">Budget</label>
                <input
                  type="number"
                  id="budget"
                  name="budget"
                  placeholder="Enter Budget Details"
                  value={formData.budget}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  placeholder="Enter location"
                  value={formData.location}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="startDate">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDate">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  required
                  min={formData.startDate} 
                />
              </div>
            </div>

            <div className="form-row single-column">
              <div className="form-group">
                <label htmlFor="manpower">Manpower</label>
                <textarea
                  id="manpower"
                  name="manpower"
                  placeholder="Add manpower details"
                  value={formData.manpower}
                  onChange={handleChange}
                ></textarea>
              </div>
            </div>

            <div className="form-row submit-row">
              <button type="submit" className="submit-button">Add Project</button>
            </div>
          </form>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="footer">
        <div className="footer-column">
          <p className="footer-category">Member</p>
          <a href="#" className="footer-link">Become A Member</a>
          <a href="#" className="footer-link">Running Shoe Finder</a>
          <a href="#" className="footer-link">Product Advice</a>
          <a href="#" className="footer-link">Education Discounts</a>
          <a href="#" className="footer-link">Send Us Feedback</a>
        </div>
        
        <div className="footer-column">
          <p className="footer-category">Orders</p>
          <a href="#" className="footer-link">Order Status</a>
          <a href="#" className="footer-link">Delivery</a>
          <a href="#" className="footer-link">Returns</a>
          <a href="#" className="footer-link">Payment Options</a>
          <a href="#" className="footer-link">Contact Us</a>
        </div>
        
        <div className="footer-column">
          <p className="footer-category">About</p>
          <a href="#" className="footer-link">News</a>
          <a href="#" className="footer-link">Careers</a>
          <a href="#" className="footer-link">Investors</a>
          <a href="#" className="footer-link">Sustainability</a>
          <a href="#" className="footer-link">Impact</a>
        </div>
      </footer>
    </div>
  );
}

export default Ceo_Addproject;
