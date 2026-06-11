import React from 'react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';

export const DashboardLayout = ({children, breadcrumbs=[]}) => {
  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <Breadcrumbs items={breadcrumbs} />
      {children}
    </div>
  );
}
