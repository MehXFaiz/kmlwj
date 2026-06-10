import React from 'react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';

export const DashboardLayout = ({children, breadcrumbs=[]}) => {
  return (
    <div className="p-4 md:p-6">
      <Breadcrumbs items={breadcrumbs} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
