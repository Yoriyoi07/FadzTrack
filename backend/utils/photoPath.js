function getPhotoPath(type, id, originalName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (type === 'project') {
    return `project-photos/project-${id}/${timestamp}_${originalName}`;
  } else if (type === 'material-request') {
    // New standard: material-requests/<userId>/<timestamp>_<original>
    return `material-requests/${id}/${timestamp}_${originalName}`; // here 'id' should be caller-provided userId
  }
  throw new Error('Invalid type');
}
module.exports = getPhotoPath;
