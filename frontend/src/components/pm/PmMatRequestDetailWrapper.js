import React from 'react';
import MaterialRequestDetailView from '../material/MaterialRequestDetailView';
import PmMaterialHeader from './PmMaterialHeader';

const PmMatRequestDetailWrapper = () => (
  <MaterialRequestDetailView
    role="Project Manager"
    rootClass="pm-request-detail"
    headerTitle="PM Material Request Detail"
    headerSubtitle="Review, validate and view approvals"
    customHeader={<PmMaterialHeader title="PM Material Request Detail" subtitle="Review, validate and view approvals" />}
  />
);

export default PmMatRequestDetailWrapper;
