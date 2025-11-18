"use client";

import * as React from "react";

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
}>({
  activeTab: "",
  setActiveTab: () => {},
});

export function Tabs({ defaultValue, children, className = "" }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }: TabsListProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-brand-100 p-1 ${className}`}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = "" }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
        isActive
          ? "bg-white text-brand-800 shadow-sm"
          : "text-brand-600 hover:text-brand-800"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = "" }: TabsContentProps) {
  const { activeTab } = React.useContext(TabsContext);

  if (activeTab !== value) {
    return null;
  }

  return <div className={className}>{children}</div>;
}
