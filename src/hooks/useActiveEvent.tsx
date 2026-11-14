'use client';


import {
  setTenantEvent,
  clearTenantEvent,
  selectCurrentTenantId,
  selectCurrentTenantName,
  selectActiveEventData,
} from '@/store/slices/authSlice';
import { EventItem } from '@/store/types/events';
import { useDispatch, useSelector } from 'react-redux';

export function useActiveEvent() {
  const dispatch = useDispatch();

  // Connect component states directly to global Redux memory
  const eventId = useSelector(selectCurrentTenantId);
  const eventName = useSelector(selectCurrentTenantName);
  const activeEvent = useSelector(selectActiveEventData);

  const selectEvent = (event: EventItem) => {
    dispatch(setTenantEvent(event));
  };

  const clearEvent = () => {
    dispatch(clearTenantEvent());
  };

  return {
    eventId,
    eventName,
    activeEvent,
    selectEvent,
    clearEvent
  };
}