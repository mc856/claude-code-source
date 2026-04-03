export type NotebookCellType = 'code' | 'markdown' | 'raw'

export type NotebookCell = {
  id?: string
  source: string | string[]
  cell_type?: NotebookCellType
}

export type NotebookContent = {
  cells: NotebookCell[]
}
