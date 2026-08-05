import React from 'react';
import { useLocation } from 'react-router-dom';
import { AddIncomeForm } from './AddIncomeForm';
import { AddIncomeRecords } from './AddIncomeRecords';

export const AddIncome = () => {
  const location = useLocation();

  // If path ends with /records or contains ?view=records, show records list
  const isRecordsView = location.pathname.endsWith('/records') || location.search.includes('view=records');

  if (isRecordsView) {
    return <AddIncomeRecords />;
  }

  // Primary view: Dedicated Full-Page Form
  return <AddIncomeForm />;
};
