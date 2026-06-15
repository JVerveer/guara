import type { CloudRisk, DependencyItem, OutageSimulation, Vendor } from '../types';
import type { ParsedDocument } from '../ingestion/types';

export function buildCloudRisk(vendors: Vendor[]): CloudRisk[] {
  const cloudVendors = vendors.filter((vendor) => vendor.category === 'Cloud');

  if (cloudVendors.length === 0) {
    return [];
  }

  if (cloudVendors.length === 1) {
    return [
      {
        label: cloudVendors[0].name,
        pct: 85,
        spend: cloudVendors[0].spend,
      },
    ];
  }

  return cloudVendors.map((vendor, index) => ({
    label: vendor.name,
    pct: index === 0 ? 60 : Math.max(10, Math.round(40 / (cloudVendors.length - 1))),
    spend: vendor.spend,
  }));
}

export function buildDependencies(vendors: Vendor[]): DependencyItem[] {
  return vendors
    .filter((vendor) => vendor.criticality === 'Critical' || vendor.dependency === 'Critical')
    .slice(0, 6)
    .map((vendor) => ({
      vendor: vendor.name,
      service: vendor.service,
      impact:
        vendor.category === 'Cloud'
          ? 'Core application hosting, APIs, data processing, and operational services'
          : vendor.category === 'Payments'
            ? 'Payment acceptance, settlement, refunds, and disputes'
            : vendor.category === 'Identity'
              ? 'Authentication, privileged access, and workforce identity'
              : vendor.category === 'Data'
                ? 'Analytics, reporting, and data processing'
                : 'Critical business workflow dependency',
      icon:
        vendor.category === 'Cloud'
          ? 'cloud'
          : vendor.category === 'Payments'
            ? 'payments'
            : vendor.category === 'Identity'
              ? 'identity'
              : 'data',
    }));
}

export function buildOutageSimulation(
  documents: ParsedDocument[],
  vendors: Vendor[]
): OutageSimulation {
  const cloudVendor = vendors.find((vendor) => vendor.category === 'Cloud');
  const criticalCount = vendors.filter((vendor) => vendor.criticality === 'Critical').length;

  const affectedServices = buildDependencies(vendors)
    .map((dependency) => dependency.service)
    .slice(0, 5);

  return {
    provider: cloudVendor?.name ?? 'Primary technology provider',
    affectedDependencies: Math.max(criticalCount, affectedServices.length),
    affectedServices:
      affectedServices.length > 0
        ? affectedServices
        : ['Customer portal', 'Data processing', 'Internal operations'],
    impact: criticalCount >= 4 ? 'Severe' : 'High',
    recovery:
      criticalCount >= 4
        ? '10–20 days without validated contingency plan'
        : '5–10 days depending on backup provider readiness',
    recommendation:
      'Define exit options and test service recovery for critical technology dependencies.',
  };
}
