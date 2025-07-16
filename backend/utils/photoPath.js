function getPhotoPath(type, id, originalName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (type === 'project') {
    return `project-photos/project-${id}/${timestamp}_${originalName}`;
  } else if (type === 'material-request') {
    return `material-request-photos/request-${id}/${timestamp}_${originalName}`;
  }
  throw new Error('Invalid type');
}
module.exports = getPhotoPath;
