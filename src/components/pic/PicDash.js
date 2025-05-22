import React, { useState, useEffect } from 'react';
import '../style/pm_style/Pm_Dash.css';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
const PicDash = () => {
  
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  const [userName, setUserName] = useState(user?.name || '');
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

 
  // Request data
  const [requests, setRequests] = useState([
    { 
      id: 1, 
      name: 'Calatagan Townhomes',
      requestor: 'Rychea Miralles',
      date: '09/15/2022',
      status: 'Pending',
      icon: '📦'
    },
    { 
      id: 2, 
      name: 'Request for Cement',
      requestor: 'Project: Building A',
      date: '09/15/2022',
      requestedBy: 'John Doe',
      status: 'Pending',
      icon: '📦'
    },
    { 
      id: 3, 
      name: 'Request for Cement',
      requestor: 'Project: Building A',
      date: '09/15/2022',
      requestedBy: 'John Doe',
      status: 'Pending',
      icon: '📦'
    },
    { 
      id: 4, 
      name: 'Request for Steel Bars',
      requestor: 'Project: Infrastructure Project B',
      date: '09/20/2022',
      requestedBy: 'Jane Smith',
      status: 'Declined',
      icon: '🔧'
    },
    { 
      id: 5, 
      name: 'Request for Steel Bars',
      requestor: 'Project: Infrastructure Project B',
      date: '09/20/2022',
      requestedBy: 'Jane Smith',
      status: 'Approved',
      icon: '🔧'
    },
    { 
      id: 6, 
      name: 'Request for Bricks',
      requestor: 'Project: Residential Development C',
      date: '09/25/2022',
      requestedBy: 'Emily Brown',
      status: 'Declined',
      icon: '🧱'
    },
    { 
      id: 7, 
      name: 'Request for Bricks',
      requestor: 'Project: Residential Development C',
      date: '09/25/2022',
      requestedBy: 'Emily Brown',
      status: 'Pending',
      icon: '🧱'
    }
  ]);

  // Chats data - for sidebar
  const [chats, setChats] = useState([
    { 
      id: 1, 
      name: 'Rychea Miralles', 
      initial: 'R',
      message: 'Hello Good Morning po! As...',
      color: '#4A6AA5'
    },
    { 
      id: 2, 
      name: 'Third Castellar', 
      initial: 'T',
      message: 'Hello Good Morning po! As...',
      color: '#2E7D32'
    },
    { 
      id: 3, 
      name: 'Zenarose Miranda', 
      initial: 'Z',
      message: 'Hello Good Morning po! As...',
      color: '#9C27B0'
    }
  ]);

  // Status badge style function
  const getStatusBadgeStyle = (status) => {
    switch(status) {
      case 'Approved':
        return { backgroundColor: '#4caf50', color: 'white' };
      case 'Declined':
        return { backgroundColor: '#f44336', color: 'white' };
      case 'Pending':
      default:
        return { backgroundColor: '#e0e0e0', color: '#333' };
    }
  };

 useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/projects');
        const data = await res.json();
        console.log('Fetched projects:', data);
        // Filter only projects that include current user as PIC
       const filtered = data.filter(project =>
  Array.isArray(project.assignedTo) &&
  project.assignedTo.some(
    person => person.name === user.name && person.role === 'PIC'
  )
);


        setProjects(filtered);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
      navigate('/');
      return;
    }

    const fetchProject = async () => {
      try {
        // Fetch all projects assigned to this PIC
        const res = await fetch(`http://localhost:5000/api/projects/assigned/${user.id}`);
        const data = await res.json();
         console.log('Fetched assigned projects:', data);
        // If there are multiple, just pick the first one
        setProject(data[0] || null);
      } catch (err) {
        console.error('Failed to fetch project:', err);
        setProject(null);
      }
    };

    fetchProject();
  }, [navigate]);

  return (
     <div className="head">
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
            <Link to="/pic" className="nav-link">Dashboard</Link>
            <Link to="/requests" className="nav-link">Requests</Link>
            {project && (
    <Link to={`/pic/${project._id}`}>View Project</Link>
  )}
            <Link to="/chat" className="nav-link">Chat</Link>
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
               {user?.name?.charAt(0).toUpperCase() || 'U'}
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
      <div className="dashboard-layout">
        {/* Left Sidebar */}
        <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', width: '200px', padding: '20px' }}>
          <h2>Requests</h2>
          <button 
            className="add-project-btn" 
            style={{ marginBottom: '20px' }}
          >
            Add New Request
          </button>
          
          {/* Chats List in Left Sidebar */}
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>Chats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {chats.map(chat => (
                <div key={chat.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    backgroundColor: chat.color, 
                    color: 'white', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginRight: '12px',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}>
                    {chat.initial}
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>{chat.name}</div>
                    <div style={{ fontSize: '12px', color: '#777' }}>{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className="main1" style={{ flex: '1', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Good Morning, {userName}!</h1>
            
            <div>
              <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Request Overview</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {requests.map(request => (
                  <div key={request.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '12px', 
                    borderBottom: '1px solid #eee'
                  }}>
                    <div style={{ 
                      fontSize: '24px', 
                      marginRight: '15px', 
                      backgroundColor: '#f5f5f5', 
                      padding: '8px', 
                      borderRadius: '8px' 
                    }}>
                      {request.icon}
                    </div>
                    
                    <div style={{ flex: '1' }}>
                      <div style={{ fontWeight: '500', fontSize: '15px' }}>{request.name}</div>
                      <div style={{ fontSize: '13px', color: '#666' }}>{request.requestor}</div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '120px' }}>
                      {request.requestedBy && <div style={{ fontSize: '14px' }}>{request.requestedBy}</div>}
                      <div style={{ fontSize: '13px', color: '#666' }}>{request.date}</div>
                    </div>
                    
                    <div style={{ 
                      marginLeft: '15px', 
                      padding: '4px 12px', 
                      borderRadius: '4px', 
                      fontSize: '12px',
                      fontWeight: '500',
                      ...getStatusBadgeStyle(request.status)
                    }}>
                      {request.status}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', gap: '5px' }}>
                <button style={{ width: '30px', height: '30px', border: '1px solid #ddd', backgroundColor: 'white', borderRadius: '4px' }}>«</button>
                <button style={{ width: '30px', height: '30px', border: 'none', backgroundColor: '#5E4FDB', color: 'white', borderRadius: '4px' }}>1</button>
                <button style={{ width: '30px', height: '30px', border: '1px solid #ddd', backgroundColor: 'white', borderRadius: '4px' }}>2</button>
                <button style={{ width: '30px', height: '30px', border: '1px solid #ddd', backgroundColor: 'white', borderRadius: '4px' }}>3</button>
                <button style={{ width: '30px', height: '30px', border: '1px solid #ddd', backgroundColor: 'white', borderRadius: '4px' }}>4</button>
                <button style={{ width: '30px', height: '30px', border: '1px solid #ddd', backgroundColor: 'white', borderRadius: '4px' }}>5</button>
                <button style={{ width: '30px', height: '30px', border: '1px solid #ddd', backgroundColor: 'white', borderRadius: '4px' }}>»</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PicDash;