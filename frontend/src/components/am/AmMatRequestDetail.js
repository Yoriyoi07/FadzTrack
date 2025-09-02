import React from 'react';
import MaterialRequestDetailView from '../material/MaterialRequestDetailView';
import AmMaterialHeader from './AmMaterialHeader';

const AmMatRequestDetail = () => (
  <MaterialRequestDetailView
    role="Area Manager"
    rootClass="am-request-detail"
    headerTitle="Material Request Detail"
    headerSubtitle="Approve or review final status"
    /* Removed customHeader to use unified AppHeader */
  />
);

export default AmMatRequestDetail;
