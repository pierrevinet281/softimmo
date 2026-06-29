// Configs partagées (colonnes + champs) pour les tableaux Bâtiments / Unités, réutilisées par
// le détail de propriété (Module 1) et la page Ajouter/Éditer (onglet Bâtiments & unités/pièces).
import React from 'react';
import { Building, DoorOpen } from 'lucide-react';
import { Badge } from '../components/ui.jsx';
import { num, money } from './format.js';

export const LEASE_TYPES = ['', 'brut', 'net', 'TMI'];

export function buildingsConfig(t) {
  return {
    path: 'buildings', titleKey: 'd.tab.buildings', icon: Building,
    columns: [
      { key: 'label', label: t('common.name'), render: (r) => r.label || r.building_type || '—' },
      { key: 'building_type', label: t('d.bld.type') },
      { key: 'year_built', label: t('d.bld.year'), align: 'num' },
      { key: 'land_area', label: t('d.bld.land'), align: 'num', render: (r) => num(r.land_area) },
      { key: 'building_area', label: t('d.bld.footprint'), align: 'num', render: (r) => num(r.building_area) },
      { key: 'livable_area', label: t('d.bld.livable'), align: 'num', render: (r) => num(r.livable_area) },
    ],
    fields: [
      { key: 'label', label: t('common.name'), half: true },
      { key: 'building_type', label: t('d.bld.type'), half: true },
      { key: 'year_built', label: t('d.bld.year'), type: 'number', half: true },
      { key: 'floors_above', label: t('d.bld.floorsAbove'), type: 'number', half: true },
      { key: 'floors_basement', label: t('d.bld.floorsBasement'), type: 'number', half: true },
      { key: 'land_area', label: t('d.bld.land'), type: 'number', half: true },
      { key: 'building_area', label: t('d.bld.footprint'), type: 'number', half: true },
      { key: 'livable_area', label: t('d.bld.livable'), type: 'number', half: true },
      { key: 'structure', label: t('d.bld.structure'), half: true },
      { key: 'foundation', label: t('d.bld.foundation'), half: true },
      { key: 'exterior_cladding', label: t('d.bld.cladding'), half: true },
      { key: 'roofing', label: t('d.bld.roofing'), half: true },
      { key: 'fenestration', label: t('d.bld.fenestration'), half: true },
      { key: 'flooring', label: t('d.bld.flooring'), half: true },
      { key: 'notes', label: t('common.notes'), type: 'textarea' },
    ],
  };
}

export function unitsConfig(t, buildings) {
  const bldOptions = [{ value: '', label: '—' }, ...buildings.map((b) => ({ value: b.id, label: b.label || b.building_type || b.id }))];
  return {
    path: 'units', titleKey: 'd.tab.units', icon: DoorOpen,
    columns: [
      { key: 'label', label: t('d.unit.label'), render: (r) => r.label || '—' },
      { key: 'unit_type', label: t('common.type') },
      { key: 'area', label: t('d.unit.area'), align: 'num', render: (r) => num(r.area) },
      { key: 'rent_monthly', label: t('d.unit.rent'), align: 'num', render: (r) => money(r.rent_monthly) },
      { key: 'other_income', label: t('d.unit.other'), align: 'num', render: (r) => money(r.other_income) },
      { key: 'lease_end', label: t('d.unit.leaseEnd') },
      { key: 'is_vacant', label: t('d.unit.vacant'), render: (r) => (Number(r.is_vacant) === 1 ? <Badge tone="warning">{t('d.unit.vacant')}</Badge> : <Badge tone="success">{t('d.unit.occupied')}</Badge>) },
    ],
    fields: [
      { key: 'label', label: t('d.unit.label'), half: true },
      { key: 'unit_type', label: t('common.type'), placeholder: 'ex. 4½', half: true },
      { key: 'building_id', label: t('d.tab.buildings'), type: 'select', options: bldOptions, half: true },
      { key: 'area', label: t('d.unit.area'), type: 'number', half: true },
      { key: 'bedrooms', label: t('d.unit.bedrooms'), type: 'number', half: true },
      { key: 'bathrooms', label: t('d.unit.bathrooms'), type: 'number', half: true },
      { key: 'rent_monthly', label: t('d.unit.rent'), type: 'number', half: true },
      { key: 'other_income', label: t('d.unit.other'), type: 'number', half: true },
      { key: 'lease_type', label: t('d.unit.leaseType'), type: 'select', options: LEASE_TYPES.map((v) => ({ value: v, label: v || '—' })), half: true },
      { key: 'lease_end', label: t('d.unit.leaseEnd'), placeholder: 'AAAA-MM-JJ', half: true },
      { key: 'occupant', label: t('d.unit.occupant'), half: true },
      { key: 'is_vacant', label: t('d.unit.vacant'), type: 'checkbox', half: true },
      { key: 'notes', label: t('common.notes'), type: 'textarea' },
    ],
  };
}
