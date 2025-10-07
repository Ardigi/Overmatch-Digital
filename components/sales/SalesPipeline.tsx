'use client';

import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  BuildingOfficeIcon,
  CalendarIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface Deal {
  id: string;
  company: string;
  contact: string;
  value: number;
  service: string;
  probability: number;
  nextAction: string;
  nextActionDate: string;
  daysInStage: number;
  notes?: string;
}

interface Stage {
  id: string;
  name: string;
  deals: Deal[];
  value: number;
  probability: number;
}

export default function SalesPipeline() {
  const [stages, setStages] = useState<Stage[]>([
    {
      id: 'prospecting',
      name: 'Prospecting',
      probability: 10,
      value: 450000,
      deals: [
        {
          id: '1',
          company: 'GlobalTech Industries',
          contact: 'Sarah Mitchell',
          value: 150000,
          service: 'SOC 2 Type II',
          probability: 10,
          nextAction: 'Initial discovery call',
          nextActionDate: '2024-07-20',
          daysInStage: 3,
        },
        {
          id: '2',
          company: 'FinanceFlow Systems',
          contact: 'David Chen',
          value: 180000,
          service: 'SOC 1 & SOC 2',
          probability: 10,
          nextAction: 'Send information packet',
          nextActionDate: '2024-07-18',
          daysInStage: 5,
        },
        {
          id: '3',
          company: 'MedData Solutions',
          contact: 'Jennifer Adams',
          value: 120000,
          service: 'SOC 2 + HIPAA',
          probability: 10,
          nextAction: 'LinkedIn connection',
          nextActionDate: '2024-07-19',
          daysInStage: 1,
        },
      ],
    },
    {
      id: 'qualification',
      name: 'Qualification',
      probability: 25,
      value: 580000,
      deals: [
        {
          id: '4',
          company: 'SecureCloud Corp',
          contact: 'Michael Torres',
          value: 135000,
          service: 'SOC 2 Type II',
          probability: 25,
          nextAction: 'Technical requirements review',
          nextActionDate: '2024-07-22',
          daysInStage: 8,
        },
        {
          id: '5',
          company: 'DataVault Inc',
          contact: 'Lisa Wang',
          value: 95000,
          service: 'Readiness Assessment',
          probability: 25,
          nextAction: 'Budget confirmation call',
          nextActionDate: '2024-07-21',
          daysInStage: 12,
        },
        {
          id: '6',
          company: 'TechStart Solutions',
          contact: 'Robert Johnson',
          value: 110000,
          service: 'SOC 2 Type I to II',
          probability: 25,
          nextAction: 'Stakeholder meeting',
          nextActionDate: '2024-07-23',
          daysInStage: 6,
        },
        {
          id: '7',
          company: 'CloudPay Systems',
          contact: 'Amanda Foster',
          value: 240000,
          service: 'SOC 1 + PCI DSS',
          probability: 25,
          nextAction: 'Security team review',
          nextActionDate: '2024-07-24',
          daysInStage: 10,
        },
      ],
    },
    {
      id: 'proposal',
      name: 'Proposal',
      probability: 60,
      value: 420000,
      deals: [
        {
          id: '8',
          company: 'Enterprise Solutions Ltd',
          contact: 'Thomas Brown',
          value: 185000,
          service: 'SOC 2 Type II + Pen Test',
          probability: 60,
          nextAction: 'Proposal presentation',
          nextActionDate: '2024-07-18',
          daysInStage: 15,
        },
        {
          id: '9',
          company: 'InnovateTech',
          contact: 'Rachel Green',
          value: 125000,
          service: 'SOC 2 Type II',
          probability: 60,
          nextAction: 'Contract negotiation',
          nextActionDate: '2024-07-19',
          daysInStage: 18,
        },
        {
          id: '10',
          company: 'HealthTech Pro',
          contact: 'James Wilson',
          value: 110000,
          service: 'SOC 2 + HIPAA',
          probability: 60,
          nextAction: 'Legal review meeting',
          nextActionDate: '2024-07-20',
          daysInStage: 20,
        },
      ],
    },
    {
      id: 'negotiation',
      name: 'Negotiation',
      probability: 80,
      value: 290000,
      deals: [
        {
          id: '11',
          company: 'FinServ Global',
          contact: 'Patricia Martinez',
          value: 165000,
          service: 'SOC 1 & SOC 2',
          probability: 80,
          nextAction: 'Final terms discussion',
          nextActionDate: '2024-07-17',
          daysInStage: 25,
        },
        {
          id: '12',
          company: 'DataSecure Inc',
          contact: 'Kevin Liu',
          value: 125000,
          service: 'SOC 2 Type II',
          probability: 80,
          nextAction: 'Contract signing',
          nextActionDate: '2024-07-16',
          daysInStage: 28,
        },
      ],
    },
    {
      id: 'closed',
      name: 'Closed Won',
      probability: 100,
      value: 110000,
      deals: [
        {
          id: '13',
          company: 'TechCorp Solutions',
          contact: 'John Smith',
          value: 110000,
          service: 'SOC 2 Type II',
          probability: 100,
          nextAction: 'Kickoff meeting',
          nextActionDate: '2024-07-25',
          daysInStage: 0,
          notes: 'Closed this week!',
        },
      ],
    },
  ]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;

    if (source.droppableId !== destination.droppableId) {
      const sourceStage = stages.find((s) => s.id === source.droppableId);
      const destStage = stages.find((s) => s.id === destination.droppableId);

      if (!sourceStage || !destStage) return;

      const sourceDeal = sourceStage.deals[source.index];

      // Update deal probability based on new stage
      const updatedDeal = {
        ...sourceDeal,
        probability: destStage.probability,
        daysInStage: 0,
      };

      const newStages = stages.map((stage) => {
        if (stage.id === source.droppableId) {
          return {
            ...stage,
            deals: stage.deals.filter((_, index) => index !== source.index),
            value: stage.value - sourceDeal.value,
          };
        }
        if (stage.id === destination.droppableId) {
          const newDeals = [...stage.deals];
          newDeals.splice(destination.index, 0, updatedDeal);
          return {
            ...stage,
            deals: newDeals,
            value: stage.value + sourceDeal.value,
          };
        }
        return stage;
      });

      setStages(newStages);
    }
  };

  const totalPipelineValue = stages.reduce((sum, stage) => sum + stage.value, 0);
  const weightedPipelineValue = stages.reduce(
    (sum, stage) =>
      sum +
      stage.deals.reduce((dealSum, deal) => dealSum + (deal.value * deal.probability) / 100, 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Pipeline Value</p>
          <p className="text-2xl font-bold text-gray-900">${totalPipelineValue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Weighted Pipeline Value</p>
          <p className="text-2xl font-bold text-gray-900">
            ${Math.round(weightedPipelineValue).toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Opportunities</p>
          <p className="text-2xl font-bold text-gray-900">
            {stages.reduce((sum, stage) => sum + stage.deals.length, 0)}
          </p>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div key={stage.id} className="flex-shrink-0 w-80">
              <div className="bg-gray-100 rounded-t-lg p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                  <span className="text-sm text-gray-600">{stage.deals.length} deals</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  ${stage.value.toLocaleString()} • {stage.probability}%
                </p>
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`bg-gray-50 min-h-[400px] p-2 ${
                      snapshot.isDraggingOver ? 'bg-blue-50' : ''
                    }`}
                  >
                    {stage.deals.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white rounded-lg p-4 mb-2 shadow-sm hover:shadow-md transition-shadow ${
                              snapshot.isDragging ? 'shadow-lg opacity-90' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium text-gray-900">{deal.company}</h4>
                                <p className="text-sm text-gray-600">{deal.contact}</p>
                              </div>
                              <span className="text-lg font-semibold text-gray-900">
                                ${(deal.value / 1000).toFixed(0)}k
                              </span>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex items-center gap-2 text-gray-600">
                                <CurrencyDollarIcon className="h-3.5 w-3.5" />
                                {deal.service}
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {format(new Date(deal.nextActionDate), 'MMM d')}
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <UserIcon className="h-3.5 w-3.5" />
                                {deal.nextAction}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                {deal.daysInStage} days in stage
                              </span>
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  deal.probability >= 60
                                    ? 'bg-green-100 text-green-800'
                                    : deal.probability >= 25
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {deal.probability}% prob
                              </span>
                            </div>

                            {deal.notes && (
                              <p className="mt-2 text-xs text-primary-600 font-medium">
                                {deal.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <div className="flex justify-between items-center">
        <button className="btn-secondary">Export Pipeline</button>
        <button className="btn-primary">Add New Deal</button>
      </div>
    </div>
  );
}
