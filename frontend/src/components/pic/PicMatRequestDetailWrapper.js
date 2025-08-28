import React from 'react';
import MaterialRequestDetailView from '../material/MaterialRequestDetailView';
import PicMaterialHeader from './PicMaterialHeader';

const PicMatRequestDetailWrapper = () => (
  <MaterialRequestDetailView
    role="Person in Charge"
    rootClass="pic-request-detail"
    headerTitle="Material Request Detail"
    headerSubtitle="View lifecycle and receive materials"
    customHeader={<PicMaterialHeader title="Material Request Detail" subtitle="View lifecycle and receive materials" />}
  />
);

export default PicMatRequestDetailWrapper;
