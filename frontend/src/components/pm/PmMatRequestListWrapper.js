import React from 'react';
import MaterialRequestListView from '../material/MaterialRequestListView';
import PmMaterialHeader from './PmMaterialHeader';

const PmMatRequestListWrapper = () => (
  <MaterialRequestListView
    role="Project Manager"
    fetchUrl="/requests/mine"
    detailLinkBase="/pm/material-request"
    rootClass="pm-request-list"
    headerTitle="PM Material Requests"
    headerSubtitle="Validate and track material requests"
    customHeader={<PmMaterialHeader title="PM Material Requests" subtitle="Validate and track material requests" />}
  />
);

export default PmMatRequestListWrapper;
