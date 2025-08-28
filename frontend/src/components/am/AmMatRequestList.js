import React from 'react';
import MaterialRequestListView from '../material/MaterialRequestListView';
import AmMaterialHeader from './AmMaterialHeader';

const AmMatRequestList = () => (
  <MaterialRequestListView
    role="Area Manager"
    fetchUrl="/requests/mine"
    detailLinkBase="/am/material-request"
    rootClass="am-request-list"
    headerTitle="AM Material Requests"
    headerSubtitle="Approve validated requests and monitor delivery"
    customHeader={<AmMaterialHeader title="AM Material Requests" subtitle="Approve validated requests and monitor delivery" />}
  />
);

export default AmMatRequestList;
