import React from 'react';
import MaterialRequestDetailView from '../material/MaterialRequestDetailView';
import AppHeader from '../layout/AppHeader';

const PmMatRequestDetailWrapper = () => (
  <>
    <AppHeader roleSegment="pm" />
    <MaterialRequestDetailView
      role="Project Manager"
      rootClass="pm-request-detail"
      disableHeader
    />
  </>
);

export default PmMatRequestDetailWrapper;
