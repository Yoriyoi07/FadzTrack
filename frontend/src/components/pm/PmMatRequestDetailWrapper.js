import React from 'react';
import MaterialRequestDetailView from '../material/MaterialRequestDetailView';
import AppHeader from '../layout/AppHeader';

const PmMatRequestDetailWrapper = () => (
  <>
    <AppHeader roleSegment="pm" />
    <div className="page-heading" style={{ padding: '0 1.5rem', marginTop: '1rem' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 600 }}>PM Material Request Detail</h2>
      <p style={{ margin: 0, fontSize: '.72rem', opacity: 0.7 }}>Review, validate and view approvals</p>
    </div>
    <MaterialRequestDetailView
      role="Project Manager"
      rootClass="pm-request-detail"
      disableHeader
    />
  </>
);

export default PmMatRequestDetailWrapper;
