import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { useState } from "react";

import { DataTable, type Column, type TableFilter } from "@/components/masters/DataTable";
import { PageHeader } from "@/components/masters/PageHeader";
import { RecordFormSheet, type FormStep } from "@/components/masters/RecordFormSheet";
import { StatusChip } from "@/components/masters/StatusChip";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { vehicles, carriers, type Vehicle, type Carrier } from "@/data/masters";

export const Route = createFileRoute("/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehicle & Carrier Master — Meridia ERP" },
      {
        name: "description",
        content:
          "Fleet and transport partner master with capacity, insurance, permits and driver assignment.",
      },
      { property: "og:title", content: "Vehicle & Carrier Master — Meridia ERP" },
      {
        property: "og:description",
        content: "Own fleet and contracted carriers with compliance and service level data.",
      },
    ],
  }),
  component: VehicleMaster,
});

const vehicleSteps: FormStep[] = [
  {
    title: "Basic Information",
    description: "Registration and vehicle classification",
    fields: [
      { name: "code", label: "Vehicle Code", required: true, placeholder: "VEH-1010" },
      { name: "registration", label: "Registration Number", required: true },
      {
        name: "type",
        label: "Vehicle Type",
        type: "select",
        required: true,
        options: ["Truck", "Trailer", "Van", "Reefer", "Container"],
      },
      { name: "make", label: "Make" },
      { name: "model", label: "Model" },
      { name: "year", label: "Year", type: "number" },
      { name: "status", label: "Status", type: "switch" },
    ],
  },
  {
    title: "Contact",
    description: "Capacity, driver and ownership",
    fields: [
      { name: "capacityWeight", label: "Capacity (tonnes)", type: "number" },
      { name: "capacityVolume", label: "Capacity (m³)", type: "number" },
      { name: "fuelType", label: "Fuel Type", type: "select", options: ["Diesel", "Electric", "CNG", "Hybrid"] },
      { name: "ownership", label: "Ownership", type: "select", options: ["Owned", "Leased", "Contracted"] },
      { name: "driver", label: "Assigned Driver" },
      { name: "gpsDevice", label: "GPS Device ID" },
    ],
  },
  {
    title: "Documents",
    description: "Insurance, permits and maintenance",
    fields: [
      { name: "insuranceExpiry", label: "Insurance Expiry", type: "date" },
      { name: "permitExpiry", label: "Permit Expiry", type: "date" },
      { name: "lastService", label: "Last Service Date", type: "date" },
    ],
  },
];

const carrierSteps: FormStep[] = [
  {
    title: "Basic Information",
    description: "Carrier identification and mode",
    fields: [
      { name: "code", label: "Carrier Code", required: true },
      { name: "name", label: "Carrier Name", required: true },
      { name: "mode", label: "Mode", type: "select", options: ["Road", "Rail", "Air", "Sea"] },
      { name: "scacCode", label: "SCAC Code" },
      { name: "status", label: "Status", type: "switch" },
    ],
  },
  {
    title: "Contact",
    description: "Service coverage and commercial terms",
    fields: [
      { name: "contact", label: "Contact Person" },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "serviceArea", label: "Service Area", colSpan: 2 },
      { name: "rateCard", label: "Rate Card" },
      { name: "onTimeRate", label: "On-time %", type: "number" },
    ],
  },
  {
    title: "Documents",
    description: "Contracts and liability cover",
    fields: [{ name: "contract", label: "Contract Reference" }],
  },
];

function VehicleMaster() {
  const [vOpen, setVOpen] = useState(false);
  const [cOpen, setCOpen] = useState(false);

  const vehicleColumns: Column<Vehicle>[] = [
    {
      key: "code",
      header: "Code",
      value: (r) => r.code,
      render: (r) => <span className="num text-xs font-semibold text-primary">{r.code}</span>,
    },
    {
      key: "registration",
      header: "Registration",
      value: (r) => r.registration,
      render: (r) => <span className="num font-medium">{r.registration}</span>,
    },
    {
      key: "type",
      header: "Type",
      value: (r) => r.type,
      render: (r) => <Badge variant="secondary">{r.type}</Badge>,
    },
    { key: "make", header: "Make & model", value: (r) => `${r.make} ${r.model}` },
    { key: "year", header: "Year", value: (r) => r.year, hiddenByDefault: true },
    {
      key: "capacity",
      header: "Capacity",
      value: (r) => r.capacityWeight,
      render: (r) => (
        <span className="num text-xs">
          {r.capacityWeight} t · {r.capacityVolume} m³
        </span>
      ),
    },
    { key: "fuel", header: "Fuel", value: (r) => r.fuelType, hiddenByDefault: true },
    { key: "ownership", header: "Ownership", value: (r) => r.ownership },
    { key: "driver", header: "Driver", value: (r) => r.driver },
    {
      key: "insurance",
      header: "Insurance expiry",
      value: (r) => r.insuranceExpiry,
      render: (r) => <span className="num text-xs">{r.insuranceExpiry}</span>,
    },
    {
      key: "permit",
      header: "Permit expiry",
      value: (r) => r.permitExpiry,
      render: (r) => <span className="num text-xs">{r.permitExpiry}</span>,
      hiddenByDefault: true,
    },
    { key: "gps", header: "GPS device", value: (r) => r.gpsDevice, hiddenByDefault: true },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      render: (r) => <StatusChip value={r.status} />,
    },
  ];

  const vehicleFilters: TableFilter<Vehicle>[] = [
    {
      key: "type",
      label: "Type",
      options: [...new Set(vehicles.map((v) => v.type))],
      match: (r, v) => r.type === v,
    },
    {
      key: "ownership",
      label: "Ownership",
      options: ["Owned", "Leased", "Contracted"],
      match: (r, v) => r.ownership === v,
    },
    {
      key: "status",
      label: "Status",
      options: ["Active", "Inactive", "Under Maintenance"],
      match: (r, v) => r.status === v,
    },
  ];

  const carrierColumns: Column<Carrier>[] = [
    {
      key: "code",
      header: "Code",
      value: (r) => r.code,
      render: (r) => <span className="num text-xs font-semibold text-primary">{r.code}</span>,
    },
    { key: "name", header: "Carrier", value: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: "mode",
      header: "Mode",
      value: (r) => r.mode,
      render: (r) => <Badge variant="secondary">{r.mode}</Badge>,
    },
    { key: "serviceArea", header: "Service area", value: (r) => r.serviceArea },
    { key: "contact", header: "Contact", value: (r) => r.contact },
    { key: "phone", header: "Phone", value: (r) => r.phone, hiddenByDefault: true },
    { key: "scac", header: "SCAC", value: (r) => r.scacCode, hiddenByDefault: true },
    { key: "rate", header: "Rate card", value: (r) => r.rateCard },
    {
      key: "onTime",
      header: "On-time %",
      value: (r) => r.onTimeRate,
      render: (r) => <span className="num font-medium">{r.onTimeRate}%</span>,
    },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      render: (r) => <StatusChip value={r.status} />,
    },
  ];

  return (
    <div className="min-h-full">
      <PageHeader
        crumbs={[{ label: "Master Data Management", to: "/" }, { label: "Vehicle & Carrier" }]}
        icon={<Truck className="h-5 w-5" />}
        title="Vehicle & Carrier Master"
        description="Own fleet, contracted carriers, compliance windows and transport service levels."
      />
      <div className="p-4 sm:p-6">
        <Tabs defaultValue="vehicles">
          <TabsList>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="carriers">Carriers</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="mt-4">
            <DataTable
              rows={vehicles}
              columns={vehicleColumns}
              filters={vehicleFilters}
              entity="Vehicles"
              createLabel="Add Vehicle"
              getId={(r) => r.id}
              getLabel={(r) => r.registration}
              searchText={(r) => `${r.code} ${r.registration} ${r.make} ${r.model} ${r.driver}`}
              onCreate={() => setVOpen(true)}
              onEdit={() => setVOpen(true)}
            />
          </TabsContent>

          <TabsContent value="carriers" className="mt-4">
            <DataTable
              rows={carriers}
              columns={carrierColumns}
              filters={[
                {
                  key: "mode",
                  label: "Mode",
                  options: ["Road", "Rail", "Air", "Sea"],
                  match: (r, v) => r.mode === v,
                },
              ]}
              entity="Carriers"
              createLabel="Add Carrier"
              getId={(r) => r.id}
              getLabel={(r) => r.name}
              searchText={(r) => `${r.code} ${r.name} ${r.serviceArea} ${r.contact}`}
              onCreate={() => setCOpen(true)}
              onEdit={() => setCOpen(true)}
            />
          </TabsContent>
        </Tabs>
      </div>
      <RecordFormSheet open={vOpen} onOpenChange={setVOpen} entity="Vehicle" steps={vehicleSteps} />
      <RecordFormSheet open={cOpen} onOpenChange={setCOpen} entity="Carrier" steps={carrierSteps} />
    </div>
  );
}
