const ManpowerRequest = require('../models/ManpowerRequest');

const createManpowerRequest = async (req, res) => {
  try {
    const {
      requestTitle,
      projectLocation,
      manpowerType,
      manpowerQuantity,
      description
    } = req.body;

    const attachments = req.files?.map(file => file.filename) || [];

    const newRequest = new ManpowerRequest({
      requestTitle,
      projectLocation,
      manpowerType,
      manpowerQuantity,
      description,
      attachments
    });

    await newRequest.save();
    res.status(201).json({ message: '✅ Manpower request created successfully' });
  } catch (error) {
    console.error('❌ Error creating request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// READ - Get all manpower requests
const getAllManpowerRequests = async (req, res) => {
  try {
    const requests = await ManpowerRequest.find().sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error('❌ Error fetching requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// UPDATE - Update a specific request
const updateManpowerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedRequest = await ManpowerRequest.findByIdAndUpdate(id, updates, { new: true });

    if (!updatedRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.status(200).json({ message: '✅ Request updated successfully', data: updatedRequest });
  } catch (error) {
    console.error('❌ Error updating request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE - Remove a specific request
const deleteManpowerRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedRequest = await ManpowerRequest.findByIdAndDelete(id);

    if (!deletedRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.status(200).json({ message: '🗑️ Request deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createManpowerRequest,
  getAllManpowerRequests,
  updateManpowerRequest,
  deleteManpowerRequest
};
