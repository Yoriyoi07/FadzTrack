const mongoose = require('mongoose');
const DailyReport = require('../models/DailyReport');
const Project = require('../models/Project');
const User = require('../models/User');

// Test script to verify the new progress calculation logic
async function testProgressCalculation() {
  try {
    // Connect to MongoDB (adjust connection string as needed)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fadztrack');
    console.log('Connected to MongoDB');

    // Find a project with multiple PiCs
    const project = await Project.findOne({ 
      pic: { $exists: true, $ne: [] },
      $expr: { $gt: [{ $size: "$pic" }, 1] } // More than 1 PiC
    }).populate('pic', 'name');

    if (!project) {
      console.log('No project found with multiple PiCs. Creating test data...');
      
      // Create test users (PiCs)
      const pic1 = new User({
        name: 'Test PiC 1',
        email: 'testpic1@example.com',
        role: 'PIC',
        password: 'hashedpassword'
      });
      const pic2 = new User({
        name: 'Test PiC 2', 
        email: 'testpic2@example.com',
        role: 'PIC',
        password: 'hashedpassword'
      });
      
      await pic1.save();
      await pic2.save();
      
      // Create test project
      const testProject = new Project({
        projectName: 'Test Multi-PiC Project',
        pic: [pic1._id, pic2._id],
        location: new mongoose.Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      });
      await testProject.save();
      
      // Create test daily reports
      const report1 = new DailyReport({
        project: testProject._id,
        submittedBy: pic1._id,
        date: new Date(),
        workPerformed: [
          { task: 'Task 1', status: 'Completed', remarks: 'Done' },
          { task: 'Task 2', status: 'In Progress', remarks: 'Working on it' },
          { task: 'Task 3', status: 'Not Started', remarks: 'Not yet' }
        ],
        weatherCondition: 'Sunny',
        remarks: 'Good progress'
      });
      
      const report2 = new DailyReport({
        project: testProject._id,
        submittedBy: pic2._id,
        date: new Date(),
        workPerformed: [
          { task: 'Task A', status: 'Completed', remarks: 'Done' },
          { task: 'Task B', status: 'Completed', remarks: 'Done' },
          { task: 'Task C', status: 'In Progress', remarks: 'Working on it' }
        ],
        weatherCondition: 'Cloudy',
        remarks: 'Making good progress'
      });
      
      await report1.save();
      await report2.save();
      
      console.log('Test data created successfully');
      console.log('Project ID:', testProject._id);
      console.log('PiC 1 ID:', pic1._id);
      console.log('PiC 2 ID:', pic2._id);
      
      // Test the new endpoints
      await testEndpoints(testProject._id);
      
    } else {
      console.log('Found project with multiple PiCs:', project.projectName);
      console.log('PiCs:', project.pic.map(p => p.name));
      
      // Test the new endpoints
      await testEndpoints(project._id);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

async function testEndpoints(projectId) {
  console.log('\n=== Testing New Endpoints ===');
  
  // Import the controller functions
  const dailyReportController = require('../controllers/dailyReportController');
  
  // Mock request and response objects
  const mockReq = { params: { projectId } };
  const mockRes = {
    json: (data) => {
      console.log('Response:', JSON.stringify(data, null, 2));
    },
    status: (code) => ({
      json: (data) => {
        console.log(`Status ${code}:`, JSON.stringify(data, null, 2));
      }
    })
  };
  
  console.log('\n1. Testing getProjectProgress (averaged across PiCs):');
  await dailyReportController.getProjectProgress(mockReq, mockRes);
  
  console.log('\n2. Testing getProjectPicContributions:');
  await dailyReportController.getProjectPicContributions(mockReq, mockRes);
}

// Run the test
if (require.main === module) {
  testProgressCalculation();
}

module.exports = { testProgressCalculation };
