'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types';

export function useCustomerSearch() {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const customerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 3) {
      setCustomerResults([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`phone.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(5);

      if (!error && data) setCustomerResults(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
    customerTimeoutRef.current = setTimeout(
      () => searchCustomers(customerSearch),
      300
    );
    return () => {
      if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
    };
  }, [customerSearch, searchCustomers]);

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setCustomerResults([]);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
  };

  const reset = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setShowNewCustomer(false);
    setCustomerResults([]);
  };

  return {
    customerSearch,
    setCustomerSearch,
    customerResults,
    selectedCustomer,
    showNewCustomer,
    setShowNewCustomer,
    newCustomerName,
    setNewCustomerName,
    newCustomerPhone,
    setNewCustomerPhone,
    selectCustomer,
    clearCustomer,
    reset,
  };
}
