// CEO Material Request Detail now reuses the unified MaterialRequestDetailView (same UI as IT)
// to ensure consistent styling and layout across roles.
import React from 'react';
import MaterialRequestDetailView from '../material/MaterialRequestDetailView';

const CeoMaterialRequestDetail = () => {
  return (
    <MaterialRequestDetailView
      role="CEO"
      headerTitle="Material Request Detail"
      headerSubtitle="Full lifecycle view"
      rootClass="ceo-mr-request-detail"
    />
  );
};

export default CeoMaterialRequestDetail;
