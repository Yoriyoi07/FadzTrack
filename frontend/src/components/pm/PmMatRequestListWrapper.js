import React from 'react';
import MaterialRequestListView from '../material/MaterialRequestListView';
import AppHeader from '../layout/AppHeader';

const PmMatRequestListWrapper = () => (
  <>
    <AppHeader roleSegment="pm" />
    <MaterialRequestListView
      role="Project Manager"
      fetchUrl="/requests/mine"
      detailLinkBase="/pm/material-request"
      rootClass="pm-request-list"
      disableHeader
    />
  </>
);

export default PmMatRequestListWrapper;
