import React from 'react';
import MaterialRequestListView from '../material/MaterialRequestListView';
import '../material/materialRequests.css';

const ItMatRequestListWrapper = () => (
  <MaterialRequestListView
    role="IT"
    fetchUrl="/requests/all"
    detailLinkBase="/it/material-request"
    rootClass="it-request-list"
    headerTitle="Material Requests"
    headerSubtitle="All material requests (IT view)"
  />
);

export default ItMatRequestListWrapper;
