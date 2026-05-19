import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ActivityLog } from '../lib/activityLogger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Activity, Users, Image as ImageIcon, Globe, Clock, Search, FilterX } from 'lucide-react';
import { format, differenceInMinutes, startOfDay, isSameDay } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  AreaChart, Area
} from 'recharts';

export function ActivityDashboard() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch the last 2000 logs for analytics to keep it performant
      const logsQuery = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(2000));
      const snapshot = await getDocs(logsQuery);
      const fetchedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Filtering ---
  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.action))).sort(), [logs]);
  const uniqueUserNames = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => map.set(l.userId, l.userName));
    return Array.from(map.entries()); // [userId, userName]
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (log.projectName && log.projectName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      const matchesUser = userFilter === 'all' || log.userId === userFilter;
      return matchesSearch && matchesAction && matchesUser;
    });
  }, [logs, searchTerm, actionFilter, userFilter]);


  // --- Metrics Calculation ---
  const metrics = useMemo(() => {
    const uniqueUsers = new Set<string>();
    const uniqueProjects = new Set<string>();
    let totalImages = 0;
    
    // For time estimation: group by user and day, then calc difference between first and last action
    const sessionsMap = new Map<string, { start: Date, end: Date }>();

    filteredLogs.forEach(log => {
      if (!log.timestamp) return;
      const date = log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp);
      
      uniqueUsers.add(log.userId);
      if (log.projectId) uniqueProjects.add(log.projectId);
      if (log.action === 'Generate Image') totalImages++;

      const sessionKey = `${log.userId}-${startOfDay(date).getTime()}`;
      const existing = sessionsMap.get(sessionKey);
      
      if (!existing) {
        sessionsMap.set(sessionKey, { start: date, end: date });
      } else {
        if (date < existing.start) existing.start = date;
        if (date > existing.end) existing.end = date;
      }
    });

    let totalMinutes = 0;
    sessionsMap.forEach(session => {
      const diff = differenceInMinutes(session.end, session.start);
      // If diff is 0 (only one action that day), assume at least 5 minutes of work
      totalMinutes += diff > 0 ? diff : 5;
    });

    return {
      users: uniqueUsers.size,
      projects: uniqueProjects.size,
      images: totalImages,
      hours: (totalMinutes / 60).toFixed(1)
    };
  }, [filteredLogs]);

  // --- Chart Data Preparation ---
  const chartData = useMemo(() => {
    // Images generated per user
    const imagesByUserMap = new Map<string, number>();
    // Activity over time (by day)
    const activityByDayMap = new Map<string, number>();

    filteredLogs.forEach(log => {
      if (!log.timestamp) return;
      const date = log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp);
      const dayStr = format(date, 'MMM dd');

      // Activity by day
      activityByDayMap.set(dayStr, (activityByDayMap.get(dayStr) || 0) + 1);

      // Images by user
      if (log.action === 'Generate Image') {
        const name = log.userName.split(' ')[0] || 'Unknown';
        imagesByUserMap.set(name, (imagesByUserMap.get(name) || 0) + 1);
      }
    });

    const imagesByUser = Array.from(imagesByUserMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 users

    // Sort days chronologically (assuming last 2000 logs covers recent history)
    const activityOverTime = Array.from(activityByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .reverse(); // Reverse since logs are desc

    return { imagesByUser, activityOverTime };
  }, [filteredLogs]);




  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando estadísticas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Registro de Actividades</h2>
        <p className="text-muted-foreground mt-1">Estadísticas y monitorización del uso de la plataforma.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Imágenes Generadas</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.images}</div>
            <p className="text-xs text-muted-foreground">En el historial reciente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Países Trabajados</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.projects}</div>
            <p className="text-xs text-muted-foreground">Proyectos únicos modificados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.users}</div>
            <p className="text-xs text-muted-foreground">Colaboradores distintos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas de Trabajo</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.hours}h</div>
            <p className="text-xs text-muted-foreground">Tiempo estimado invertido</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Imágenes Generadas por Usuario</CardTitle>
            <CardDescription>Top 10 usuarios con más imágenes generadas</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.imagesByUser.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.imagesByUser} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" className="text-xs" stroke="currentColor" />
                  <YAxis className="text-xs" stroke="currentColor" />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Imágenes" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No hay datos suficientes</div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Actividad a lo Largo del Tiempo</CardTitle>
            <CardDescription>Volumen de acciones por día</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.activityOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.activityOverTime} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="date" className="text-xs" stroke="currentColor" />
                  <YAxis className="text-xs" stroke="currentColor" />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/.2)" name="Acciones" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No hay datos suficientes</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registro Detallado</CardTitle>
          <CardDescription>Listado completo de todas las interacciones en la plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en detalles o proyecto..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Acciones</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Usuarios</SelectItem>
                {uniqueUserNames.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchTerm || actionFilter !== 'all' || userFilter !== 'all') && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSearchTerm('');
                  setActionFilter('all');
                  setUserFilter('all');
                }}
                className="px-3"
              >
                <FilterX className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            )}
          </div>

          <div className="rounded-md border border-border">
            <div className="max-h-[500px] overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 font-medium">Fecha y Hora</th>
                    <th className="px-6 py-3 font-medium">Usuario</th>
                    <th className="px-6 py-3 font-medium">Acción</th>
                    <th className="px-6 py-3 font-medium">Detalles</th>
                    <th className="px-6 py-3 font-medium">Proyecto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.slice(0, 100).map((log, i) => { // show only top 100 in table to keep fast
                      const date = log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp);
                      return (
                        <tr key={log.id || i} className="bg-card hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                            {format(date, 'dd/MM/yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {log.userName}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border-transparent">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground max-w-[300px] truncate" title={log.details}>
                            {log.details}
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {log.projectName || '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                        No se encontraron registros que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredLogs.length > 100 && (
              <div className="bg-muted p-2 text-center text-xs text-muted-foreground">
                Mostrando los últimos 100 resultados de {filteredLogs.length}. Usa los filtros para refinar la búsqueda.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
