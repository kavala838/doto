export interface Child {
  id: string;
  title: string;
  description: string;
  childs: Child[];
  done: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  isHot: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  completed?: boolean;
  createdAt: number;
  updatedAt?: number;
  completedAt?: number;
  week?: number | null;
  duration?: number | null;
  childs: Child[];
  done: number;
  tags: string[];
}

export interface AppData {
  goals: Goal[];
  tags: Tag[];
} 