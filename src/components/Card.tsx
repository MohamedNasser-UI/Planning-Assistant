import type React from "react";

interface CardProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, actions, children }) => {
  return (
    <section className="card">
      <header className="card-header">
        <h2 className="card-title">{title}</h2>
        {actions && <div className="card-actions">{actions}</div>}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
};

