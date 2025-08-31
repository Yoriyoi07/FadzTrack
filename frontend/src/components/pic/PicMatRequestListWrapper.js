import React from 'react';
import MaterialRequestListView from '../material/MaterialRequestListView';

const PicMatRequestListWrapper = () => (
  <MaterialRequestListView
    role="Person in Charge"
    fetchUrl="/requests/mine"
    detailLinkBase="/pic/material-request"
    rootClass="pic-request-list"
    headerTitle="My Material Requests"
    headerSubtitle="Track, create and receive materials"
  />
);

export default PicMatRequestListWrapper;
