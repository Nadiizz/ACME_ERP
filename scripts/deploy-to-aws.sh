#!/bin/bash

# ============================================================================
# ACME ERP - AWS Deployment Script (Automatizado)
# ============================================================================
# Este script automatiza el despliegue completo de ACME ERP en AWS
# Uso: bash scripts/deploy-to-aws.sh --region us-east-1 --domain your-domain.com
# ============================================================================

set -e  # Exit on error

# ============================================================================
# COLORES Y UTILIDADES
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# ============================================================================
# VALIDACIONES PRE-DEPLOYMENT
# ============================================================================

print_header "VALIDANDO PRE-REQUISITOS"

# Verificar AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI no está instalado. Instálalo desde: https://aws.amazon.com/cli/"
fi
print_success "AWS CLI instalado"

# Verificar Git
if ! command -v git &> /dev/null; then
    print_error "Git no está instalado"
fi
print_success "Git instalado"

# Verificar jq
if ! command -v jq &> /dev/null; then
    print_error "jq no está instalado. Instálalo con: apt-get install jq"
fi
print_success "jq instalado"

# Verificar credenciales AWS
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS CLI no está autenticado. Ejecuta: aws configure"
fi
print_success "AWS autenticado"

# ============================================================================
# CONFIGURACIÓN INICIAL
# ============================================================================

print_header "CONFIGURACIÓN"

# Argumentos
REGION="${1:-us-east-1}"
DOMAIN_NAME="${2:-localhost}"
ENVIRONMENT="${3:-production}"
KEY_NAME="acme-erp-$(date +%s)"

print_info "Región: $REGION"
print_info "Dominio: $DOMAIN_NAME"
print_info "Ambiente: $ENVIRONMENT"
print_info "Nombre de clave: $KEY_NAME"

# ============================================================================
# CREAR KEY PAIR
# ============================================================================

print_header "PASO 1: CREAR KEY PAIR SSH"

if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" 2>/dev/null | grep -q "$KEY_NAME"; then
    print_info "Key pair ya existe: $KEY_NAME"
else
    aws ec2 create-key-pair \
        --key-name "$KEY_NAME" \
        --region "$REGION" \
        --query 'KeyMaterial' \
        --output text > ~/.ssh/$KEY_NAME.pem
    
    chmod 400 ~/.ssh/$KEY_NAME.pem
    print_success "Key pair creado: $KEY_NAME"
fi

# ============================================================================
# CREAR VPC
# ============================================================================

print_header "PASO 2: CREAR VPC"

VPC_ID=$(aws ec2 create-vpc \
    --cidr-block 10.0.0.0/16 \
    --region "$REGION" \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=acme-erp-vpc}]" \
    --query 'Vpc.VpcId' \
    --output text)

print_success "VPC creada: $VPC_ID"

# Habilitar DNS
aws ec2 modify-vpc-attribute \
    --vpc-id "$VPC_ID" \
    --enable-dns-hostnames \
    --region "$REGION"

print_success "DNS habilitado"

# ============================================================================
# CREAR INTERNET GATEWAY
# ============================================================================

print_header "PASO 3: CREAR INTERNET GATEWAY"

IGW_ID=$(aws ec2 create-internet-gateway \
    --region "$REGION" \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=acme-igw}]" \
    --query 'InternetGateway.InternetGatewayId' \
    --output text)

print_success "Internet Gateway creado: $IGW_ID"

aws ec2 attach-internet-gateway \
    --internet-gateway-id "$IGW_ID" \
    --vpc-id "$VPC_ID" \
    --region "$REGION"

print_success "IGW adjunto a VPC"

# ============================================================================
# CREAR SUBNETS
# ============================================================================

print_header "PASO 4: CREAR SUBNETS"

# Obtener AZs disponibles
AZ1=$(aws ec2 describe-availability-zones \
    --region "$REGION" \
    --query 'AvailabilityZones[0].ZoneName' \
    --output text)

AZ2=$(aws ec2 describe-availability-zones \
    --region "$REGION" \
    --query 'AvailabilityZones[1].ZoneName' \
    --output text)

# Subnet pública
PUBLIC_SUBNET=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block 10.0.1.0/24 \
    --availability-zone "$AZ1" \
    --region "$REGION" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=acme-public-subnet}]" \
    --query 'Subnet.SubnetId' \
    --output text)

print_success "Subnet pública creada: $PUBLIC_SUBNET"

# Subnet privada
PRIVATE_SUBNET=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block 10.0.2.0/24 \
    --availability-zone "$AZ2" \
    --region "$REGION" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=acme-private-subnet}]" \
    --query 'Subnet.SubnetId' \
    --output text)

print_success "Subnet privada creada: $PRIVATE_SUBNET"

# ============================================================================
# CREAR ROUTE TABLES
# ============================================================================

print_header "PASO 5: CREAR ROUTE TABLES"

RT_PUBLIC=$(aws ec2 create-route-table \
    --vpc-id "$VPC_ID" \
    --region "$REGION" \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=acme-public-rt}]" \
    --query 'RouteTable.RouteTableId' \
    --output text)

print_success "Route table pública creada: $RT_PUBLIC"

# Agregar ruta a IGW
aws ec2 create-route \
    --route-table-id "$RT_PUBLIC" \
    --destination-cidr-block 0.0.0.0/0 \
    --gateway-id "$IGW_ID" \
    --region "$REGION"

# Asociar subnet a RT
aws ec2 associate-route-table \
    --subnet-id "$PUBLIC_SUBNET" \
    --route-table-id "$RT_PUBLIC" \
    --region "$REGION"

print_success "Route table asociada"

# ============================================================================
# CREAR SECURITY GROUPS
# ============================================================================

print_header "PASO 6: CREAR SECURITY GROUPS"

# ALB SG
ALB_SG=$(aws ec2 create-security-group \
    --group-name acme-alb-sg \
    --description "Security group for ACME ERP ALB" \
    --vpc-id "$VPC_ID" \
    --region "$REGION" \
    --query 'GroupId' \
    --output text)

print_success "ALB Security Group: $ALB_SG"

# Inbound rules para ALB
aws ec2 authorize-security-group-ingress \
    --group-id "$ALB_SG" \
    --protocol tcp --port 80 --cidr 0.0.0.0/0 \
    --region "$REGION"

aws ec2 authorize-security-group-ingress \
    --group-id "$ALB_SG" \
    --protocol tcp --port 443 --cidr 0.0.0.0/0 \
    --region "$REGION"

# EC2 SG
EC2_SG=$(aws ec2 create-security-group \
    --group-name acme-ec2-sg \
    --description "Security group for ACME ERP EC2" \
    --vpc-id "$VPC_ID" \
    --region "$REGION" \
    --query 'GroupId' \
    --output text)

print_success "EC2 Security Group: $EC2_SG"

# SSH
aws ec2 authorize-security-group-ingress \
    --group-id "$EC2_SG" \
    --protocol tcp --port 22 --cidr 0.0.0.0/0 \
    --region "$REGION"

# HTTP/HTTPS
aws ec2 authorize-security-group-ingress \
    --group-id "$EC2_SG" \
    --protocol tcp --port 80 --cidr 0.0.0.0/0 \
    --region "$REGION"

aws ec2 authorize-security-group-ingress \
    --group-id "$EC2_SG" \
    --protocol tcp --port 443 --cidr 0.0.0.0/0 \
    --region "$REGION"

# RDS SG
RDS_SG=$(aws ec2 create-security-group \
    --group-name acme-rds-sg \
    --description "Security group for ACME ERP RDS" \
    --vpc-id "$VPC_ID" \
    --region "$REGION" \
    --query 'GroupId' \
    --output text)

print_success "RDS Security Group: $RDS_SG"

# PostgreSQL from EC2
aws ec2 authorize-security-group-ingress \
    --group-id "$RDS_SG" \
    --protocol tcp --port 5432 \
    --source-group "$EC2_SG" \
    --region "$REGION"

# ============================================================================
# CREAR RDS SUBNET GROUP
# ============================================================================

print_header "PASO 7: CREAR RDS SUBNET GROUP"

# Crear segunda subnet para RDS (requiere 2 subnets en diferentes AZs)
PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block 10.0.3.0/24 \
    --availability-zone "$AZ1" \
    --region "$REGION" \
    --query 'Subnet.SubnetId' \
    --output text)

aws rds create-db-subnet-group \
    --db-subnet-group-name acme-rds-subnet-group \
    --db-subnet-group-description "Subnet group for ACME ERP RDS" \
    --subnet-ids "$PRIVATE_SUBNET" "$PRIVATE_SUBNET_2" \
    --region "$REGION"

print_success "RDS Subnet Group creado"

# ============================================================================
# CREAR RDS POSTGRESQL
# ============================================================================

print_header "PASO 8: CREAR RDS POSTGRESQL"

DB_PASSWORD=$(openssl rand -base64 24)

aws rds create-db-instance \
    --db-instance-identifier acme-erp-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 16.3 \
    --master-username postgres \
    --master-user-password "$DB_PASSWORD" \
    --db-name acme_erp \
    --allocated-storage 100 \
    --storage-type gp3 \
    --vpc-security-group-ids "$RDS_SG" \
    --db-subnet-group-name acme-rds-subnet-group \
    --publicly-accessible false \
    --multi-az true \
    --backup-retention-period 7 \
    --backup-window "03:00-04:00" \
    --maintenance-window "sun:04:00-sun:05:00" \
    --enable-cloudwatch-logs-exports postgresql \
    --region "$REGION"

print_success "RDS Instance creada (acme-erp-db)"
print_info "Contraseña temporal guardada: Se muestra al final"

# ============================================================================
# ESPERAR RDS
# ============================================================================

print_header "ESPERANDO A QUE RDS ESTÉ DISPONIBLE..."

for i in {1..60}; do
    STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier acme-erp-db \
        --region "$REGION" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text 2>/dev/null || echo "creating")
    
    if [ "$STATUS" = "available" ]; then
        print_success "RDS disponible"
        break
    fi
    
    echo -ne "Status: $STATUS ... $(($i*10))s\r"
    sleep 10
done

# Obtener endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier acme-erp-db \
    --region "$REGION" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

print_success "RDS Endpoint: $RDS_ENDPOINT"

# ============================================================================
# LANZAR INSTANCIA EC2
# ============================================================================

print_header "PASO 9: LANZAR INSTANCIA EC2"

# Obtener AMI de Ubuntu 22.04 LTS
UBUNTU_AMI=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --region "$REGION" \
    --output text)

print_info "Ubuntu AMI: $UBUNTU_AMI"

# Crear user-data script
cat > /tmp/user-data.sh << 'USERDATA'
#!/bin/bash
set -e

# Logs
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=== INICIANDO SETUP ==="

# Update
apt-get update -qq
apt-get upgrade -y -qq

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Docker Compose
apt-get install -y -qq docker-compose

# AWS CLI
apt-get install -y -qq awscli

# Git
apt-get install -y -qq git

# Clonar repo
cd /home/ubuntu
sudo -u ubuntu git clone https://github.com/your-username/acme-erp.git
cd acme-erp

# Copiar .env
cp .env.example .env

# Variables
SECRET_KEY=$(openssl rand -base64 32)
DB_PASSWORD="REPLACE_DB_PASSWORD"
RDS_ENDPOINT="REPLACE_RDS_ENDPOINT"
DOMAIN_NAME="REPLACE_DOMAIN_NAME"
AWS_ACCESS_KEY="REPLACE_AWS_KEY"
AWS_SECRET_KEY="REPLACE_AWS_SECRET"

# Actualizar .env
sed -i "s|your-secret-key-change-this-in-production|$SECRET_KEY|" .env
sed -i "s|your-secure-password|$DB_PASSWORD|" .env
sed -i "s|your-rds-endpoint|$RDS_ENDPOINT|" .env
sed -i "s|your-domain.com|$DOMAIN_NAME|" .env
sed -i "s|your-aws-key|$AWS_ACCESS_KEY|" .env
sed -i "s|your-aws-secret|$AWS_SECRET_KEY|" .env

# Iniciar servicios
docker-compose up -d

# Wait for backend
sleep 30

# Migraciones
docker-compose exec -T backend python manage.py migrate

echo "=== SETUP COMPLETADO ==="
USERDATA

# Reemplazar placeholders
sed -i "s|REPLACE_DB_PASSWORD|$DB_PASSWORD|" /tmp/user-data.sh
sed -i "s|REPLACE_RDS_ENDPOINT|$RDS_ENDPOINT|" /tmp/user-data.sh
sed -i "s|REPLACE_DOMAIN_NAME|$DOMAIN_NAME|" /tmp/user-data.sh
sed -i "s|your-username|tu-usuario-github|" /tmp/user-data.sh

# Lanzar instancia
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$UBUNTU_AMI" \
    --instance-type t3.medium \
    --key-name "$KEY_NAME" \
    --security-group-ids "$EC2_SG" \
    --subnet-id "$PUBLIC_SUBNET" \
    --associate-public-ip-address \
    --user-data file:///tmp/user-data.sh \
    --iam-instance-profile Name=ec2-ssm-role \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=acme-erp-server}]" \
    --region "$REGION" \
    --query 'Instances[0].InstanceId' \
    --output text)

print_success "Instancia EC2 lanzada: $INSTANCE_ID"

# ============================================================================
# ESPERAR EC2
# ============================================================================

print_header "ESPERANDO A QUE EC2 ESTÉ RUNNING..."

aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

# Obtener IP pública
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$REGION" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

print_success "EC2 Running: $PUBLIC_IP"

# ============================================================================
# CREAR S3 BUCKET
# ============================================================================

print_header "PASO 10: CREAR S3 BUCKET"

BUCKET_NAME="acme-erp-backups-$(date +%s)"

aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint=$REGION 2>/dev/null || true

print_success "S3 Bucket: $BUCKET_NAME"

# ============================================================================
# RESUMEN FINAL
# ============================================================================

print_header "DESPLIEGUE COMPLETADO"

echo -e "${GREEN}✓ AWS Infrastructure creada exitosamente${NC}\n"

echo -e "${YELLOW}Información de Acceso:${NC}"
echo "  SSH Command: ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$PUBLIC_IP"
echo "  Frontend URL: http://$PUBLIC_IP:3000"
echo "  Backend API: http://$PUBLIC_IP:8000/api/"
echo "  Admin Panel: http://$PUBLIC_IP:8000/admin/"

echo -e "\n${YELLOW}Credenciales de Base de Datos:${NC}"
echo "  Host: $RDS_ENDPOINT"
echo "  Database: acme_erp"
echo "  User: postgres"
echo "  Password: $DB_PASSWORD"

echo -e "\n${YELLOW}AWS Resources:${NC}"
echo "  VPC ID: $VPC_ID"
echo "  Subnet Pública: $PUBLIC_SUBNET"
echo "  Subnet Privada: $PRIVATE_SUBNET"
echo "  EC2 ID: $INSTANCE_ID"
echo "  EC2 IP: $PUBLIC_IP"
echo "  RDS Endpoint: $RDS_ENDPOINT"
echo "  S3 Bucket: $BUCKET_NAME"

echo -e "\n${YELLOW}Próximos Pasos:${NC}"
echo "  1. Esperar 2-3 minutos a que se complete el setup en EC2"
echo "  2. SSH a la instancia y verificar: docker-compose ps"
echo "  3. Crear superusuario: docker-compose exec backend python manage.py createsuperuser"
echo "  4. Configurar certificado SSL con ACM"
echo "  5. Configurar Route 53 para apuntar al ALB"

echo -e "\n${YELLOW}Documentación:${NC}"
echo "  Ver: AWS_DEPLOYMENT.md"

echo -e "\n${RED}⚠️  IMPORTANTE:${NC}"
echo "  - Guarda la contraseña de BD en un lugar seguro"
echo "  - No comitear .env a Git"
echo "  - Cambiar contraseña de superusuario en producción"
echo "  - Habilitar 2FA en AWS Console"

print_success "Setup completado. ¡Gracias por usar ACME ERP!"
