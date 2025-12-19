"use client"

import { useEffect, useState, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { VideoGroup, LocationEdit, Marker } from "@/types/markers"

type BatchEditDialogProps = {
  video: VideoGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updates: LocationEdit[]) => Promise<void>
  cityMarkers?: Marker[]
}

export function BatchEditDialog({ video, open, onOpenChange, onSave, cityMarkers = [] }: BatchEditDialogProps) {
  const [edits, setEdits] = useState<LocationEdit[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (video) {
      setEdits(video.locations.map(loc => ({
        id: loc.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        description: loc.description || '',
        city: loc.city || '',
        type: loc.type,
        parentCityId: loc.parentCityId,
      })))
    }
  }, [video])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(edits)
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  const updateEdit = (index: number, field: keyof LocationEdit, value: string | number | null | undefined) => {
    const updated = [...edits]
    updated[index] = { ...updated[index], [field]: value }
    setEdits(updated)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batch Edit: {video?.title}</DialogTitle>
          <DialogDescription>
            Edit all {video?.locationCount} location(s) for this video
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {edits.map((edit, index) => (
            <div key={edit.id} className="border rounded-lg p-4 bg-slate-900/40">
              <div className="flex items-baseline gap-2 mb-3">
                <p className="font-medium text-sm text-slate-300">Location {index + 1}</p>
                {video && video.locations[index]?.locationId && (
                  <span className="font-mono text-xs text-slate-500">
                    #{video.locations[index].locationId}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`lat-${edit.id}`} className="text-xs">Latitude</Label>
                  <Input
                    id={`lat-${edit.id}`}
                    type="number"
                    step="0.0001"
                    value={edit.latitude}
                    onChange={(e) => updateEdit(index, 'latitude', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor={`lng-${edit.id}`} className="text-xs">Longitude</Label>
                  <Input
                    id={`lng-${edit.id}`}
                    type="number"
                    step="0.0001"
                    value={edit.longitude}
                    onChange={(e) => updateEdit(index, 'longitude', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor={`city-${edit.id}`} className="text-xs">City</Label>
                  <Input
                    id={`city-${edit.id}`}
                    value={edit.city || ''}
                    onChange={(e) => updateEdit(index, 'city', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`type-${edit.id}`} className="text-xs">Type</Label>
                  <Select
                    value={edit.type || "unspecified"}
                    onValueChange={(value) => {
                      const newType = value === "unspecified" ? undefined : (value as 'city' | 'landmark')
                      updateEdit(index, 'type', newType)
                      // Clear parent city if changing to city or unspecified
                      if (newType !== 'landmark') {
                        updateEdit(index, 'parentCityId', undefined)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unspecified">Unspecified</SelectItem>
                      <SelectItem value="city">City</SelectItem>
                      <SelectItem value="landmark">Landmark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {edit.type === 'landmark' && (
                  <div>
                    <Label htmlFor={`parent-${edit.id}`} className="text-xs">Parent City</Label>
                    <Select
                      value={edit.parentCityId?.toString() || "none"}
                      onValueChange={(value) => {
                        updateEdit(index, 'parentCityId', value === "none" ? undefined : Number(value))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <SelectItem value="none">No parent</SelectItem>
                        {cityMarkers.map((city) => (
                          <SelectItem key={city.id} value={city.id.toString()}>
                            {city.creatorName} - {city.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="col-span-2">
                  <Label htmlFor={`desc-${edit.id}`} className="text-xs">Description</Label>
                  <Textarea
                    id={`desc-${edit.id}`}
                    value={edit.description || ''}
                    onChange={(e) => updateEdit(index, 'description', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : `Save ${edits.length} Location(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
