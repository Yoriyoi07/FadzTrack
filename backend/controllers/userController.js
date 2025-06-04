const User = require('../models/User');
const Project = require('../models/Project');

exports.getEligiblePMs = async (req, res) => {
  try {
    // Find all PMs
    const pms = await User.find({ role: 'Project Manager' });
    // Find PMs with ongoing projects
    const ongoingProjects = await Project.find({ status: 'Ongoing' }).select('projectmanager');
    const busyPMIds = ongoingProjects.map(p => String(p.projectmanager));
    // Filter out busy PMs
    const eligiblePMs = pms.filter(pm => !busyPMIds.includes(String(pm._id)));
    res.json(eligiblePMs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch eligible PMs' });
  }
};
