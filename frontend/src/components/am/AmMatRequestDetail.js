import React from 'react';
import MaterialRequestDetailView from '../material/MaterialRequestDetailView';
import AmMaterialHeader from './AmMaterialHeader';

const AmMatRequestDetail = () => (
  <MaterialRequestDetailView
    role="Area Manager"
    rootClass="am-request-detail"
    headerTitle="AM Material Request Detail"
    headerSubtitle="Approve or review final status"
    customHeader={<AmMaterialHeader title="AM Material Request Detail" subtitle="Approve or review final status" />}
  />
);

export default AmMatRequestDetail;
