import React from 'react';
import MaterialRequestListView from '../material/MaterialRequestListView';

const AmMatRequestList = () => (
  <MaterialRequestListView
    role="Area Manager"
    fetchUrl="/requests/mine"
    detailLinkBase="/am/material-request"
    rootClass="am-request-list"
    headerTitle="AM Material Requests"
    headerSubtitle="Approve validated requests and monitor delivery"
  />
);

export default AmMatRequestList;
