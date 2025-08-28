import React from 'react';
import MaterialRequestListView from '../material/MaterialRequestListView';

const ItMatRequestListWrapper = () => (
  <MaterialRequestListView
    role="IT"
    fetchUrl="/requests/all"
    rootClass="it-request-list"
    headerTitle="Material Requests"
    headerSubtitle="All material requests (IT view)"
  />
);

export default ItMatRequestListWrapper;
