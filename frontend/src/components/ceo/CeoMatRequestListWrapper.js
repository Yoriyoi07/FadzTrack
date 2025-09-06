import React from 'react';
import MaterialRequestListView from '../material/MaterialRequestListView';
import '../material/materialRequests.css';

const CeoMatRequestListWrapper = () => (
  <MaterialRequestListView
    role="CEO"
    fetchUrl="/requests"
    detailLinkBase="/ceo/material-request"
    rootClass="ceo-request-list"
    headerTitle="Material Requests"
    headerSubtitle="Organization-wide material requests overview"
  />
);

export default CeoMatRequestListWrapper;
