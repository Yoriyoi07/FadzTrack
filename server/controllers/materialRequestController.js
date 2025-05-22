// controllers/materialRequestController.js
const MaterialRequest = require('../models/MaterialRequest');

exports.createMaterialRequest = async (req, res) => {
  try {
    const { material, quantity, description } = req.body;
    const attachments = req.files.map(file => file.path);

    const newRequest = new MaterialRequest({
      material,
      quantity,
      description,
      attachments
    });

    await newRequest.save();
    res.status(201).json({ message: 'Material request saved successfully' });
  } catch (error) {
    console.error('❌ Error creating material request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAllMaterialRequests = async (req, res) => {
  try {
    const requests = await MaterialRequest.find().sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error('❌ Error fetching material requests:', error);
    res.status(500).json({ message: 'Failed to fetch material requests' });
  }
};
