import React from 'react';
import MaterialRequestDetailView from '../material/MaterialRequestDetailView';
import AppHeader from '../layout/AppHeader';

const ItMatRequestDetailWrapper = () => (
  <MaterialRequestDetailView
    role="IT"
    rootClass="it-request-detail"
    customHeader={<AppHeader roleSegment="it" />}
    headerTitle="Material Request Detail"
    headerSubtitle="Full lifecycle view (IT)"
  />
);

export default ItMatRequestDetailWrapper;
