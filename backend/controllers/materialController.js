const Material = require('../models/Material');

exports.getAllMaterials = async (req, res) => {
  try {
    const materials = await Material.find();
    res.json(materials);
  } catch (err) {
    // LOG ABSOLUTELY EVERYTHING
    console.error('❌ [MATERIAL] Error:', err, '\nSTACK:', err?.stack);
    res.status(500).json({ message: 'Failed to fetch materials', error: String(err), stack: err?.stack });
  }
};

